-- CreateTable
CREATE TABLE "prescription_approvals" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "doctor_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "medications" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "rejection_reason" TEXT,
    "safe_to_dispense_partial" BOOLEAN NOT NULL DEFAULT false,
    "partial_dispense_note" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_escalations" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "approval_id" TEXT,
    "specialty" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_specialties" (
    "specialty" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "can_override_specialties" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_specialties_pkey" PRIMARY KEY ("specialty")
);

-- CreateIndex
CREATE UNIQUE INDEX "prescription_approvals_prescription_id_specialty_key" ON "prescription_approvals"("prescription_id", "specialty");

-- AddForeignKey
ALTER TABLE "prescription_approvals" ADD CONSTRAINT "prescription_approvals_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_escalations" ADD CONSTRAINT "prescription_escalations_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
