-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "safe_to_dispense_partial" BOOLEAN NOT NULL DEFAULT false;
