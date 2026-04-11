import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function migrate() {
  await prisma.\(\
    CREATE TABLE IF NOT EXISTS country_pricing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      country_code CHAR(2) UNIQUE NOT NULL,
      country_name VARCHAR(100) NOT NULL,
      currency_code CHAR(3) NOT NULL,
      currency_symbol VARCHAR(5) NOT NULL,
      patient_fee NUMERIC(10,2) NOT NULL,
      pharmacy_pct NUMERIC(5,2) NOT NULL,
      driver_pct NUMERIC(5,2) NOT NULL,
      doctor_fee NUMERIC(10,2) NOT NULL,
      free_km NUMERIC(5,1) NOT NULL DEFAULT 3,
      per_km_fee NUMERIC(10,2) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  \);
  await prisma.\(\
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);
    ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
    ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code CHAR(2);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS detected_ip VARCHAR(45);
  \);
  console.log('Migration complete');
  await prisma.\();
}
migrate().catch(console.error);