import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { geocodeAddress } from '../services/geo.service';

export const profileRouter = Router();

profileRouter.post('/patient/update-address', authenticate, authorize('patient'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { address, phone } = req.body;
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const coords = await geocodeAddress(address);
  await prisma.\(
    'UPDATE patients SET address = \, lat = \, lng = \ WHERE user_id = \',
    JSON.stringify(address), coords?.lat || null, coords?.lng || null, req.user!.sub
  );
  if (phone) await prisma.user.update({ where: { id: req.user!.sub }, data: { phone } });
  res.json({ message: 'Address updated', coords });
}));

profileRouter.post('/pharmacy/update-address', authenticate, authorize('pharmacy'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { address, phone, storeName } = req.body;
  const pharmacy = await prisma.pharmacy.findUnique({ where: { userId: req.user!.sub } });
  if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });
  const coords = await geocodeAddress(address);
  await prisma.\(
    'UPDATE pharmacies SET address = \, lat = \, lng = \, store_name = \ WHERE user_id = \',
    JSON.stringify(address), coords?.lat || null, coords?.lng || null, storeName || pharmacy.storeName, req.user!.sub
  );
  if (phone) await prisma.user.update({ where: { id: req.user!.sub }, data: { phone } });
  res.json({ message: 'Address updated', coords });
}));
