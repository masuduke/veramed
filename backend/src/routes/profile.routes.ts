import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { geocodeAddress } from '../services/geo.service';

export const profileRouter = Router();

profileRouter.post('/patient/update-address', authenticate, authorize('patient'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { address, phone, dateOfBirth, gender, allergies } = req.body;
  const patient = await prisma.patient.findUnique({ where: { userId: req.user!.sub } });
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const coords = await geocodeAddress(address);
  await prisma.$executeRawUnsafe(
    'UPDATE patients SET address = $1, lat = $2, lng = $3 WHERE user_id = $4',
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
  await prisma.$executeRawUnsafe(
    'UPDATE pharmacies SET address = $1, lat = $2, lng = $3, store_name = $4 WHERE user_id = $5',
    JSON.stringify(address), coords?.lat || null, coords?.lng || null, storeName || pharmacy.storeName, req.user!.sub
  );
  if (phone) await prisma.user.update({ where: { id: req.user!.sub }, data: { phone } });
  res.json({ message: 'Address updated', coords });
}));