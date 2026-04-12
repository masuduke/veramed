import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';
import { detectCountryFromIP, isAllowedCountry } from '../services/geo.service';

export const pricingRouter = Router();

pricingRouter.get('/detect', asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const ip = (req.headers['x-forwarded-for'] as string || req.ip || '').split(',')[0].trim();
  const code = await detectCountryFromIP(ip);
  if (!code || !isAllowedCountry(code)) {
    return res.status(403).json({ blocked: true, message: 'VeraMed is not available in your region yet.' });
  }
  const rows = await prisma.$queryRawUnsafe(
    'SELECT * FROM country_pricing WHERE country_code = $1 AND is_active = true', code
  ) as any[];
  if (!rows.length) {
    return res.status(403).json({ blocked: true, message: 'Pricing not configured for your region yet.' });
  }
  res.json({ countryCode: code, pricing: rows[0] });
}));

pricingRouter.get('/all', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM country_pricing ORDER BY country_name') as any[];
  res.json(rows);
}));

pricingRouter.post('/country', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  const { country_code, country_name, currency_code, currency_symbol,
    patient_fee, pharmacy_pct, driver_pct, doctor_fee, free_km, per_km_fee } = req.body;
  await prisma.$executeRawUnsafe(
    'INSERT INTO country_pricing (country_code,country_name,currency_code,currency_symbol,patient_fee,pharmacy_pct,driver_pct,doctor_fee,free_km,per_km_fee) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (country_code) DO UPDATE SET country_name=$2,currency_code=$3,currency_symbol=$4,patient_fee=$5,pharmacy_pct=$6,driver_pct=$7,doctor_fee=$8,free_km=$9,per_km_fee=$10,updated_at=NOW()',
    country_code, country_name, currency_code, currency_symbol,
    patient_fee, pharmacy_pct, driver_pct, doctor_fee, free_km, per_km_fee
  );
  res.json({ message: 'Country pricing saved' });
}));

pricingRouter.patch('/country/:code/toggle', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  await prisma.$executeRawUnsafe('UPDATE country_pricing SET is_active = NOT is_active WHERE country_code = $1', req.params.code);
  res.json({ message: 'Toggled' });
}));

pricingRouter.delete('/country/:code', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { prisma } = await import('../server');
  await prisma.$executeRawUnsafe('DELETE FROM country_pricing WHERE country_code = $1', req.params.code);
  res.json({ message: 'Deleted' });
}));