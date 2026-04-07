import { Router } from 'express';
import Stripe from 'stripe';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { auditLog } from '../utils/audit';
import { AppError } from '../utils/errors';

export const orderRouter  = Router();
export const paymentRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

// ── ORDER ROUTES ───────────────────────────────────────────────────

orderRouter.use(authenticate);

// POST /api/orders — patient creates order from approved prescription
orderRouter.post('/',
  authorize('patient'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');

    const { prescriptionId, pharmacyId, items, deliveryAddress, specialNotes } = req.body;
    if (!prescriptionId || !pharmacyId || !items?.length || !deliveryAddress) {
      throw new AppError('Missing required fields', 400);
    }

    const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
    if (!patient) throw new AppError('Patient not found', 404);

    // Verify prescription belongs to patient and is approved
    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId: patient.id, status: 'approved' },
    });
    if (!prescription) throw new AppError('Approved prescription not found', 404);

    // Verify all medications exist and have stock
    const medicationIds = items.map((i: any) => i.medicationId);
    const medications = await prisma.medication.findMany({
      where: { id: { in: medicationIds }, pharmacyId, stock: { gt: 0 } },
    });

    if (medications.length !== items.length) {
      throw new AppError('One or more medications are unavailable', 400);
    }

    // Calculate totals
    const orderItems = items.map((item: any) => {
      const med = medications.find((m) => m.id === item.medicationId)!;
      return {
        medicationId: med.id,
        quantity:     item.quantity,
        unitPrice:    med.price,
      };
    });

    const subtotal = orderItems.reduce(
      (sum: number, i: any) => sum + Number(i.unitPrice) * i.quantity, 0,
    );
    const deliveryFee = 2.99;
    const totalPrice  = subtotal + deliveryFee;

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(totalPrice * 100), // pence
      currency: 'gbp',
      metadata: { patientId: patient.id, prescriptionId },
      automatic_payment_methods: { enabled: true },
    });

    // Create order + delivery + payment atomically
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          patientId:      patient.id,
          pharmacyId,
          prescriptionId,
          subtotal,
          deliveryFee,
          totalPrice,
          deliveryAddress,
          specialNotes,
          items: { create: orderItems },
        },
        include: { items: true },
      });

      await tx.delivery.create({
        data: {
          orderId:         o.id,
          pickupAddress:   {}, // populated from pharmacy record
          deliveryAddress,
        },
      });

      await tx.payment.create({
        data: {
          orderId:             o.id,
          stripePaymentIntent: paymentIntent.id,
          amountPence:         paymentIntent.amount,
          currency:            'GBP',
        },
      });

      return o;
    });

    await auditLog({
      userId: req.user!.sub, action: 'created',
      resourceType: 'order', resourceId: order.id,
    });

    res.status(201).json({
      orderId:             order.id,
      clientSecret:        paymentIntent.client_secret,
      totalPrice,
      deliveryFee,
    });
  }),
);

// GET /api/orders/:id/status
orderRouter.get('/:id/status', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const order = await prisma.order.findUnique({
    where:   { id: req.params.id },
    include: {
      delivery: { select: { status: true, estimatedMinutes: true, deliveredAt: true } },
      payment:  { select: { status: true } },
    },
  });
  if (!order) throw new AppError('Order not found', 404);
  res.json(order);
}));

// ── PHARMACY ORDER ROUTES ──────────────────────────────────────────

// GET /api/orders/pharmacy — pharmacy sees their orders
orderRouter.get('/pharmacy/incoming',
  authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { prisma } = await import('../server');
    const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
    if (!pharmacy) throw new AppError('Pharmacy not found', 404);

    const orders = await prisma.order.findMany({
      where:   { pharmacyId: pharmacy.id, status: { not: 'cancelled' } },
      include: {
        items:    { include: { medication: { select: { name: true, strength: true } } } },
        patient:  { include: { user: { select: { name: true } } } },
        delivery: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  }),
);

// PATCH /api/orders/:id/status — pharmacy updates order status
orderRouter.patch('/:id/status',
  authorize('pharmacy'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed = ['confirmed', 'preparing', 'ready_for_pickup'];
    if (!allowed.includes(status)) throw new AppError('Invalid status transition', 400);

    const { prisma } = await import('../server');
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data:  { status, confirmedAt: status === 'confirmed' ? new Date() : undefined },
    });

    // When ready for pickup — auto-assign driver
    if (status === 'ready_for_pickup') {
      const driver = await prisma.driver.findFirst({
        where: { isOnline: true, isVerified: true },
        orderBy: { deliveryCount: 'asc' },
      });

      if (driver) {
        await prisma.delivery.update({
          where: { orderId: order.id },
          data: {
            driverId:   driver.id,
            status:     'assigned',
            assignedAt: new Date(),
            estimatedMinutes: 45,
          },
        });

        // Notify driver
        await prisma.notification.create({
          data: {
            userId: driver.userId,
            type:   'delivery_assigned',
            title:  'New Delivery Job',
            body:   'A delivery has been assigned to you. Please pick up from the pharmacy.',
            data:   { orderId: order.id },
          },
        });
      }
    }

    res.json({ message: 'Order status updated', status });
  }),
);

// ── STRIPE WEBHOOK ─────────────────────────────────────────────────

paymentRouter.post('/webhook',
  // Raw body needed for Stripe signature verification
  asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    const { prisma } = await import('../server');

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.update({
          where: { stripePaymentIntent: pi.id },
          data: {
            status:      'succeeded',
            receiptUrl:  pi.latest_charge as string,
            paymentMethod: pi.payment_method as any,
          },
        });

        // Confirm the order
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntent: pi.id },
        });
        if (payment) {
          await prisma.order.update({
            where: { id: payment.orderId },
            data:  { status: 'confirmed', confirmedAt: new Date() },
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.update({
          where: { stripePaymentIntent: pi.id },
          data: {
            status:       'failed',
            failedReason: pi.last_payment_error?.message,
          },
        });
        break;
      }
    }

    res.json({ received: true });
  }),
);
