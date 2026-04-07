import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');
  const hash = (p: string) => bcrypt.hash(p, 12);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@veramed.health' },
    update: {},
    create: {
      name: 'VeraMed Admin', email: 'admin@veramed.health',
      passwordHash: await hash('Admin@123!'), role: 'admin', status: 'verified',
    },
  });

  // Doctor
  const docUser = await prisma.user.upsert({
    where: { email: 'dr.patel@veramed.health' },
    update: {},
    create: {
      name: 'Dr. Priya Patel', email: 'dr.patel@veramed.health',
      passwordHash: await hash('Doctor@123!'), role: 'doctor', status: 'verified',
    },
  });
  await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id, licenseNumber: 'GMC-123456',
      specialization: 'General Practice', available: true, verifiedAt: new Date(),
    },
  });

  // Pharmacy
  const pharmUser = await prisma.user.upsert({
    where: { email: 'boots@veramed.health' },
    update: {},
    create: {
      name: 'Boots Pharmacy Manchester', email: 'boots@veramed.health',
      passwordHash: await hash('Pharmacy@123!'), role: 'pharmacy', status: 'verified',
    },
  });
  const pharm = await prisma.pharmacy.upsert({
    where: { userId: pharmUser.id },
    update: {},
    create: {
      userId: pharmUser.id, storeName: 'Boots Manchester',
      licenseNumber: 'PHARM-001', address: { street: '14 Market St', city: 'Manchester', postcode: 'M1 1PT' },
    },
  });

  // Sample medications
  const meds = [
    { name: 'Metformin',       genericName: 'Metformin HCl', strength: '500mg', price: 3.99,  stock: 200 },
    { name: 'Lisinopril',      genericName: 'Lisinopril',    strength: '10mg',  price: 2.49,  stock: 150 },
    { name: 'Atorvastatin',    genericName: 'Atorvastatin',  strength: '20mg',  price: 4.99,  stock: 180 },
    { name: 'Amoxicillin',     genericName: 'Amoxicillin',   strength: '500mg', price: 5.49,  stock: 100 },
    { name: 'Paracetamol',     genericName: 'Paracetamol',   strength: '500mg', price: 1.99,  stock: 500, requiresPrescription: false },
    { name: 'Omeprazole',      genericName: 'Omeprazole',    strength: '20mg',  price: 3.29,  stock: 120 },
  ];

  for (const med of meds) {
    await prisma.medication.upsert({
      where: { id: `seed-${med.name.toLowerCase()}` },
      update: { stock: med.stock },
      create: {
        id: `seed-${med.name.toLowerCase()}`,
        pharmacyId: pharm.id, ...med,
        requiresPrescription: med.requiresPrescription ?? true,
        dosageForm: 'tablet', category: 'General',
      },
    });
  }

  // Patient
  const patUser = await prisma.user.upsert({
    where: { email: 'patient@veramed.health' },
    update: {},
    create: {
      name: 'Sarah Rahman', email: 'patient@veramed.health',
      passwordHash: await hash('Patient@123!'), role: 'patient', status: 'verified',
    },
  });
  await prisma.patient.upsert({
    where: { userId: patUser.id },
    update: {},
    create: {
      userId: patUser.id, gender: 'female', bloodType: 'O+',
      allergies: ['Penicillin'], dateOfBirth: new Date('1990-05-15'),
    },
  });

  // Driver
  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@veramed.health' },
    update: {},
    create: {
      name: 'James Wilson', email: 'driver@veramed.health',
      passwordHash: await hash('Driver@123!'), role: 'driver', status: 'verified',
    },
  });
  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id, isVerified: true, isOnline: true,
      licensePlate: 'MN72 ABC', vehicleInfo: { type: 'car', make: 'Toyota', model: 'Prius' },
    },
  });

  console.log('✅ Seed complete!');
  console.log('  admin@veramed.health     / Admin@123!');
  console.log('  dr.patel@veramed.health  / Doctor@123!');
  console.log('  boots@veramed.health     / Pharmacy@123!');
  console.log('  patient@veramed.health   / Patient@123!');
  console.log('  driver@veramed.health    / Driver@123!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
