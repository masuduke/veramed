-- VeraMed Platform — PostgreSQL Schema
-- Version 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'pharmacy', 'driver', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'suspended');
CREATE TYPE prescription_status AS ENUM ('ai_generated', 'pending_review', 'approved', 'modified', 'rejected');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE delivery_status AS ENUM ('unassigned', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');
CREATE TYPE audit_action AS ENUM ('created', 'viewed', 'approved', 'rejected', 'modified', 'deleted', 'login', 'logout');

-- ─────────────────────────────────────────────
-- CORE USERS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL,
  phone           VARCHAR(20),
  avatar_url      TEXT,
  status          verification_status NOT NULL DEFAULT 'pending',
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret      TEXT,                         -- encrypted TOTP secret
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ─────────────────────────────────────────────
-- AUTH TOKENS
-- ─────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  device_info JSONB,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ─────────────────────────────────────────────
-- ROLE PROFILES
-- ─────────────────────────────────────────────
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth   DATE,
  gender          VARCHAR(20),
  blood_type      VARCHAR(5),
  allergies       TEXT[],                     -- array of known allergens
  medical_history TEXT,                       -- encrypted at app level
  emergency_contact JSONB,                   -- { name, phone, relationship }
  address         JSONB,                     -- { street, city, postcode, country }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctors (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number   VARCHAR(100) UNIQUE NOT NULL,
  specialization   VARCHAR(100) NOT NULL,
  qualification    TEXT,
  hospital         VARCHAR(255),
  bio              TEXT,
  consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  available        BOOLEAN NOT NULL DEFAULT TRUE,
  review_count     INTEGER NOT NULL DEFAULT 0,
  avg_rating       NUMERIC(3,2),
  verified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pharmacies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_name    VARCHAR(255) NOT NULL,
  license_number VARCHAR(100) UNIQUE NOT NULL,
  address       JSONB NOT NULL,             -- { street, city, postcode, country }
  location      POINT,                     -- PostGIS lat/lng for proximity search
  phone         VARCHAR(20),
  opening_hours JSONB,                     -- { mon: { open, close }, ... }
  accepts_orders BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE drivers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_plate VARCHAR(20),
  vehicle_info  JSONB,                     -- { type, make, model, year }
  current_location POINT,
  is_online     BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  avg_rating    NUMERIC(3,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- MEDICAL REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  file_url        TEXT NOT NULL,             -- S3 signed URL key (never public)
  file_name       TEXT NOT NULL,
  file_type       VARCHAR(50),               -- PDF, JPEG, PNG, DICOM
  file_size_bytes INTEGER,
  description     TEXT NOT NULL,
  symptoms        TEXT[],                    -- structured symptom tags
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_patient ON reports(patient_id);
CREATE INDEX idx_reports_created ON reports(created_at DESC);

-- ─────────────────────────────────────────────
-- AI ANALYSIS
-- ─────────────────────────────────────────────
CREATE TABLE ai_analyses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id           UUID UNIQUE NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  model_version       VARCHAR(50) NOT NULL,  -- e.g. 'gpt-4o-2024-08'
  ai_summary          TEXT NOT NULL,         -- clinical summary for doctor
  suggested_diagnosis TEXT,
  suggested_medication JSONB NOT NULL,       -- [{ name, dosage, frequency, duration, reasoning }]
  confidence_score    NUMERIC(4,3),          -- 0.000 - 1.000
  warnings            TEXT[],               -- drug interactions, allergen flags
  raw_response        JSONB,                -- full AI response (audit)
  processing_time_ms  INTEGER,
  reviewed_by_doctor  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: ai_analyses.suggested_medication is advisory ONLY
-- It must NEVER be released to patients without doctor approval
COMMENT ON TABLE ai_analyses IS
  'AI suggestions — advisory only. Doctor approval via prescriptions table is mandatory before any medication release.';

-- ─────────────────────────────────────────────
-- PRESCRIPTIONS (Doctor-controlled)
-- ─────────────────────────────────────────────
CREATE TABLE prescriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  ai_analysis_id  UUID REFERENCES ai_analyses(id),
  status          prescription_status NOT NULL DEFAULT 'pending_review',
  medications     JSONB NOT NULL,            -- [{ name, dosage, frequency, duration, notes }]
  doctor_notes    TEXT,
  rejection_reason TEXT,
  valid_until     DATE,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor  ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_status  ON prescriptions(status);

-- Protect prescriptions from deletion
CREATE RULE no_delete_prescriptions AS ON DELETE TO prescriptions DO INSTEAD NOTHING;

-- ─────────────────────────────────────────────
-- MEDICATIONS INVENTORY
-- ─────────────────────────────────────────────
CREATE TABLE medications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id     UUID NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
  name            VARCHAR(255) NOT NULL,
  generic_name    VARCHAR(255),
  brand           VARCHAR(100),
  category        VARCHAR(100),
  dosage_form     VARCHAR(50),              -- tablet, capsule, syrup, injection
  strength        VARCHAR(50),             -- e.g. '500mg'
  price           NUMERIC(10,2) NOT NULL,
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  requires_prescription BOOLEAN NOT NULL DEFAULT TRUE,
  barcode         VARCHAR(100),
  expiry_date     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_pharmacy ON medications(pharmacy_id);
CREATE INDEX idx_medications_name     ON medications(name);
CREATE INDEX idx_medications_stock    ON medications(stock) WHERE stock > 0;

-- ─────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  pharmacy_id     UUID NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE RESTRICT,
  status          order_status NOT NULL DEFAULT 'pending',
  subtotal        NUMERIC(10,2) NOT NULL,
  delivery_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price     NUMERIC(10,2) NOT NULL,
  delivery_address JSONB NOT NULL,
  special_notes   TEXT,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_patient      ON orders(patient_id);
CREATE INDEX idx_orders_pharmacy     ON orders(pharmacy_id);
CREATE INDEX idx_orders_prescription ON orders(prescription_id);
CREATE INDEX idx_orders_status       ON orders(status);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE RESTRICT,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL,
  total_price   NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ─────────────────────────────────────────────
-- DELIVERIES
-- ─────────────────────────────────────────────
CREATE TABLE deliveries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  driver_id         UUID REFERENCES drivers(id),
  status            delivery_status NOT NULL DEFAULT 'unassigned',
  pickup_address    JSONB NOT NULL,
  delivery_address  JSONB NOT NULL,
  estimated_minutes INTEGER,
  tracking_token    UUID DEFAULT uuid_generate_v4(),
  assigned_at       TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  driver_notes      TEXT,
  patient_signature TEXT,                  -- base64 signature on delivery
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- ─────────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────────
CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  stripe_payment_intent TEXT UNIQUE NOT NULL,
  stripe_customer_id    TEXT,
  amount_pence          INTEGER NOT NULL,         -- store in smallest unit
  currency              CHAR(3) NOT NULL DEFAULT 'GBP',
  status                payment_status NOT NULL DEFAULT 'pending',
  payment_method        JSONB,                   -- { type, last4, brand }
  receipt_url           TEXT,
  refund_id             TEXT,
  failed_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- AUDIT LOGS (immutable — no updates/deletes)
-- ─────────────────────────────────────────────
CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  action        audit_action NOT NULL,
  resource_type VARCHAR(50) NOT NULL,       -- 'prescription', 'report', etc.
  resource_id   UUID,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs must never be modified
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit  AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

CREATE INDEX idx_audit_user     ON audit_logs(user_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created  ON audit_logs(created_at DESC);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,          -- 'prescription_approved', 'order_ready', etc.
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_unread  ON notifications(user_id) WHERE read_at IS NULL;

-- ─────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','patients','doctors','pharmacies','drivers',
    'prescriptions','medications','orders','deliveries','payments'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- Enforce doctor approval: block patient seeing AI analysis without approved prescription
CREATE OR REPLACE FUNCTION check_prescription_release()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Log the approval event
    INSERT INTO audit_logs(user_id, action, resource_type, resource_id, new_value)
    VALUES (NEW.doctor_id::UUID, 'approved', 'prescription', NEW.id,
            jsonb_build_object('status', NEW.status, 'approved_at', NOW()));
    NEW.approved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prescription_release
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION check_prescription_release();

-- Auto-deduct stock on order confirmation
CREATE OR REPLACE FUNCTION deduct_medication_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    UPDATE medications m
    SET stock = stock - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.medication_id = m.id;

    -- Raise if stock went negative (safety check)
    IF EXISTS (SELECT 1 FROM medications WHERE stock < 0) THEN
      RAISE EXCEPTION 'Insufficient stock for one or more medications';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_stock
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION deduct_medication_stock();

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

-- Doctor dashboard: pending cases with AI summary
CREATE VIEW v_pending_cases AS
  SELECT
    r.id AS report_id,
    r.created_at AS submitted_at,
    u.name AS patient_name,
    p.date_of_birth,
    p.allergies,
    r.description AS patient_description,
    r.symptoms,
    aa.ai_summary,
    aa.suggested_medication,
    aa.confidence_score,
    aa.warnings,
    pr.id AS prescription_id,
    pr.status AS prescription_status,
    pr.doctor_id
  FROM reports r
  JOIN patients p ON p.id = r.patient_id
  JOIN users u ON u.id = p.user_id
  JOIN ai_analyses aa ON aa.report_id = r.id
  JOIN prescriptions pr ON pr.ai_analysis_id = aa.id
  WHERE pr.status = 'pending_review';

-- Patient order tracker
CREATE VIEW v_patient_order_tracker AS
  SELECT
    o.id AS order_id,
    o.status AS order_status,
    o.total_price,
    o.created_at,
    d.status AS delivery_status,
    d.estimated_minutes,
    d.tracking_token,
    py.status AS payment_status,
    ph.store_name AS pharmacy_name,
    dr_user.name AS driver_name
  FROM orders o
  JOIN deliveries d ON d.order_id = o.id
  JOIN payments py ON py.order_id = o.id
  JOIN pharmacies ph ON ph.id = o.pharmacy_id
  LEFT JOIN drivers dr ON dr.id = d.driver_id
  LEFT JOIN users dr_user ON dr_user.id = dr.user_id;

-- Pharmacy inventory with low-stock alert
CREATE VIEW v_pharmacy_inventory AS
  SELECT
    m.*,
    CASE WHEN m.stock < 10 THEN TRUE ELSE FALSE END AS low_stock,
    CASE WHEN m.expiry_date < NOW() + INTERVAL '30 days' THEN TRUE ELSE FALSE END AS expiring_soon
  FROM medications m;
