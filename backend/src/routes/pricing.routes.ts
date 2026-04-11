import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { detectCountryFromIP, isAllowedCountry } from '../services/geo.service';

export const pricingRouter = Router();

pricingRouter.get('/detect', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
  const countryCode = await detectCountryFromIP(ip.split(',')[0].trim());
  if (!countryCode || !isAllowedCountry(countryCode)) {
    return res.status(403).json({ blocked: true, message: 'VeraMed is not available in your region yet.' });
  }
  const pricing = await prisma.\(
    'SELECT * FROM country_pricing WHERE country_code = \ AND is_active = true',
    countryCode
  ) as any[];
  if (!pricing.length) {
    return res.status(403).json({ blocked: true, message: 'VeraMed is not available in your region yet.' });
  }
  res.json({ countryCode, pricing: pricing[0] });
}));

pricingRouter.get('/all', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const pricing = await prisma.\('SELECT * FROM country_pricing ORDER BY country_name') as any[];
  res.json(pricing);
}));

pricingRouter.post('/country', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { country_code, country_name, currency_code, currency_symbol,
    patient_fee, pharmacy_pct, driver_pct, doctor_fee, free_km, per_km_fee } = req.body;
  await prisma.\(\
    INSERT INTO country_pricing (country_code, country_name, currency_code, currency_symbol,
      patient_fee, pharmacy_pct, driver_pct, doctor_fee, free_km, per_km_fee)
    VALUES (\,\,\,\,\,\,\,\,\,\)
    ON CONFLICT (country_code) DO UPDATE SET
      country_name=\, currency_code=\, currency_symbol=\,
      patient_fee=\, pharmacy_pct=\, driver_pct=\,
      doctor_fee=\, free_km=\, per_km_fee=\, updated_at=NOW()
  \, country_code, country_name, currency_code, currency_symbol,
    patient_fee, pharmacy_pct, driver_pct, doctor_fee, free_km, per_km_fee);
  res.json({ message: 'Country pricing saved' });
}));

pricingRouter.patch('/country/:code/toggle', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  await prisma.\(
    'UPDATE country_pricing SET is_active = NOT is_active WHERE country_code = \',
    req.params.code
  );
  res.json({ message: 'Toggled' });
}));

pricingRouter.delete('/country/:code', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  await prisma.\('DELETE FROM country_pricing WHERE country_code = \', req.params.code);
  res.json({ message: 'Deleted' });
}));
