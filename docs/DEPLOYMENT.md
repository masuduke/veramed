# VeraMed — Production Deployment & Architecture Guide

## System Architecture Diagram

```
                         INTERNET
                            │
                     ┌──────▼──────┐
                     │  CloudFront │  CDN + WAF
                     │  / Route53  │
                     └──────┬──────┘
                            │
              ┌─────────────▼─────────────┐
              │       Nginx Proxy          │
              │  (SSL termination, rate    │
              │   limiting, load balance)  │
              └──────┬────────────┬────────┘
                     │            │
          ┌──────────▼──┐    ┌────▼──────────┐
          │  Next.js    │    │  Express API   │
          │  Frontend   │    │  (Node.js)     │
          │  :3000      │    │  :4000         │
          └─────────────┘    └────┬───────────┘
                                  │
              ┌───────────────────┼──────────────────┐
              │                   │                   │
     ┌────────▼───────┐  ┌────────▼───────┐  ┌──────▼────────┐
     │  PostgreSQL 15  │  │   Redis 7      │  │   AWS S3      │
     │  (primary DB)   │  │  (sessions,    │  │ (encrypted    │
     │                 │  │   cache)       │  │  med. files)  │
     └─────────────────┘  └────────────────┘  └───────────────┘
              │
     ┌────────▼──────────────────────────────────────────────┐
     │                External Services                        │
     │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
     │  │ Anthropic API│  │   Stripe     │  │  SendGrid   │  │
     │  │ (AI analysis)│  │ (payments)   │  │  (email)    │  │
     │  └──────────────┘  └──────────────┘  └─────────────┘  │
     └───────────────────────────────────────────────────────┘
```

## Security Architecture

### Data Encryption
- **In Transit**: TLS 1.3 enforced everywhere (Nginx → services → databases)
- **At Rest (DB)**: PostgreSQL encrypted tablespace + column-level encryption for medical_history
- **At Rest (Files)**: S3 SSE-AES256 + server-side encryption enabled
- **Secrets**: AWS Secrets Manager or Doppler for environment variables
- **Tokens**: bcrypt (rounds=12) for passwords; SHA-256 hashing for refresh token storage

### Medical Report Access Flow
```
Patient uploads → Multer validates MIME → S3 stores with SSE-AES256
                                              ↓
Doctor requests → Auth middleware → Prisma ownership check
                                              ↓
                              GetObjectCommand + 15-min presigned URL
                                              ↓
                              URL expires automatically — no long-lived access
```

### AI Safety Chain
```
Patient report → AI Analysis Service
                      ↓
           buildAnalysisPrompt() — instructs AI:
           "You are advisory ONLY, never prescribe"
                      ↓
           AI returns structured JSON suggestions
                      ↓
           Saved to ai_analyses table (doctor-only)
                      ↓
           Prescription created with status: 'pending_review'
                      ↓
           Doctor Dashboard — review, modify, approve/reject
                      ↓
           Only AFTER approval → patient can see prescription
           Only AFTER approval → order can be placed
```

## Deployment Steps

### Prerequisites
```bash
# Required
- Docker 24+ and Docker Compose v2
- AWS account (S3, optionally ECS/ECR)
- Anthropic API key
- Stripe account (test mode for dev)
- Domain name + SSL certificate

# Optional but recommended
- Railway or Render (simpler than AWS ECS)
- Doppler or AWS Secrets Manager
- Sentry for error tracking
- Datadog for monitoring
```

### 1. Clone and Configure
```bash
git clone https://github.com/your-org/veramed
cd veramed

# Copy and fill in ALL environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with real values

cp frontend/.env.example frontend/.env.local
# Add: NEXT_PUBLIC_API_URL=https://api.yourdomain.com
# Add: NEXT_PUBLIC_STRIPE_PK=pk_live_...
```

### 2. Generate Secrets
```bash
# JWT secrets (64-char hex)
openssl rand -hex 64  # JWT_ACCESS_SECRET
openssl rand -hex 64  # JWT_REFRESH_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY (32 bytes for AES-256)
```

### 3. AWS S3 Setup
```bash
# Create S3 bucket with encryption
aws s3api create-bucket \
  --bucket veramed-medical-reports-prod \
  --region eu-west-2 \
  --create-bucket-configuration LocationConstraint=eu-west-2

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket veramed-medical-reports-prod \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# Block all public access (critical for HIPAA compliance)
aws s3api put-public-access-block \
  --bucket veramed-medical-reports-prod \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 4. Database Setup
```bash
cd backend

# Run migrations
npx prisma migrate deploy

# Seed initial data (creates admin user + test accounts)
npx tsx src/utils/seed.ts

# Verify schema
npx prisma studio  # Opens GUI at localhost:5555
```

### 5. Docker Production Deploy
```bash
cd veramed

# Build and start all services
docker-compose -f docker-compose.yml up -d --build

# Check health
docker-compose ps
curl http://localhost:4000/health

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 6. Stripe Webhook Setup
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:4000/api/payment/webhook

# In production: register webhook in Stripe Dashboard
# Endpoint: https://api.yourdomain.com/api/payment/webhook
# Events: payment_intent.succeeded, payment_intent.payment_failed
```

### 7. Nginx SSL Config
```nginx
# nginx/nginx.conf
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    # Stripe webhook raw body
    location /api/payment/webhook {
        proxy_pass http://backend:4000;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://backend:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25M;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

## API Reference

### Authentication
| Method | Endpoint              | Auth | Description               |
|--------|-----------------------|------|---------------------------|
| POST   | /api/auth/register    | No   | Register new user         |
| POST   | /api/auth/login       | No   | Login, returns token pair |
| POST   | /api/auth/refresh     | No   | Refresh access token      |
| POST   | /api/auth/logout      | Yes  | Revoke tokens             |
| GET    | /api/auth/me          | Yes  | Get current user profile  |

### Patient Endpoints
| Method | Endpoint                              | Description                      |
|--------|---------------------------------------|----------------------------------|
| POST   | /api/patient/upload-report            | Upload medical report + symptoms |
| GET    | /api/patient/reports                  | List all reports                 |
| GET    | /api/patient/reports/:id/file         | Get signed URL for report file   |
| GET    | /api/patient/prescriptions            | List prescriptions               |
| GET    | /api/patient/prescriptions/:id/pharmacies | Match approved Rx to pharmacies |
| GET    | /api/patient/orders                   | Order history + tracking         |

### Doctor Endpoints
| Method | Endpoint                                | Description                     |
|--------|-----------------------------------------|---------------------------------|
| GET    | /api/doctor/pending-cases               | Queue of cases to review        |
| GET    | /api/doctor/stats                       | Dashboard statistics            |
| POST   | /api/doctor/prescriptions/:id/approve   | Approve (with modifications)    |
| POST   | /api/doctor/prescriptions/:id/reject    | Reject with mandatory reason    |
| PATCH  | /api/doctor/availability                | Toggle accepting new cases      |

### Pharmacy Endpoints
| Method | Endpoint                         | Description                    |
|--------|----------------------------------|--------------------------------|
| GET    | /api/pharmacy/inventory          | Full medication inventory       |
| POST   | /api/pharmacy/medications        | Add new medication             |
| PATCH  | /api/pharmacy/medications/:id/stock | Update stock level          |
| GET    | /api/pharmacy/stats              | Revenue and order stats        |

### Order & Payment
| Method | Endpoint                    | Description                       |
|--------|-----------------------------|-----------------------------------|
| POST   | /api/orders                 | Create order + Stripe PaymentIntent|
| GET    | /api/orders/:id/status      | Order + delivery + payment status |
| GET    | /api/orders/pharmacy/incoming| Pharmacy's incoming orders        |
| PATCH  | /api/orders/:id/status      | Pharmacy updates order status     |
| POST   | /api/payment/webhook        | Stripe webhook handler            |

### Delivery
| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | /api/delivery/jobs           | Driver's assigned deliveries   |
| GET    | /api/delivery/available      | Unassigned jobs near driver    |
| POST   | /api/delivery/:id/accept     | Driver self-assigns job        |
| PATCH  | /api/delivery/:id/status     | Update delivery status         |
| PATCH  | /api/delivery/driver/online  | Toggle driver online status    |
| GET    | /api/delivery/track/:token   | Public order tracking (no auth)|

## Compliance Checklist

### HIPAA-Aligned Controls
- [x] All PHI encrypted in transit (TLS 1.3) and at rest (AES-256)
- [x] S3 bucket: public access fully blocked, SSE-AES256 enabled
- [x] Audit logs: immutable (DB-level rules prevent UPDATE/DELETE)
- [x] Access control: RBAC enforced — patients can't see AI analysis until approved
- [x] Minimum necessary access: signed URLs expire in 15 minutes
- [x] Doctor approval mandatory: enforced at DB trigger + API layer
- [x] Session management: refresh token rotation + forced expiry
- [x] Rate limiting: auth endpoints capped at 10 req/15min

### GDPR Controls
- [x] User data deletion: cascade deletes on user removal (except audit logs)
- [x] Data portability: patient can export their reports and prescriptions
- [x] Consent: terms acceptance at registration (tracked with timestamp)
- [x] Data minimization: only required fields collected per role

## Database Indexes Summary

```sql
-- Performance-critical indexes already in schema:
idx_users_email              -- Login lookups
idx_users_role               -- RBAC filtering
idx_refresh_tokens_hash      -- Token verification (per request)
idx_reports_patient          -- Patient's report list
idx_medications_stock        -- Availability filter (stock > 0)
idx_prescriptions_status     -- Doctor dashboard queue
idx_orders_status            -- Pharmacy and delivery views
idx_audit_created            -- Time-based audit queries
idx_notifications_unread     -- Unread notification badge
```

## Environment Variables Reference

| Variable                | Required | Description                          |
|-------------------------|----------|--------------------------------------|
| DATABASE_URL            | ✓        | PostgreSQL connection string         |
| REDIS_URL               | ✓        | Redis connection string              |
| JWT_ACCESS_SECRET       | ✓        | 64-char hex secret                   |
| JWT_REFRESH_SECRET      | ✓        | 64-char hex secret (different)       |
| ENCRYPTION_KEY          | ✓        | 32-byte hex for AES-256              |
| AWS_S3_BUCKET           | ✓        | Bucket for medical reports           |
| AWS_REGION              | ✓        | e.g. eu-west-2                       |
| ANTHROPIC_API_KEY       | ✓        | Claude API key                       |
| STRIPE_SECRET_KEY       | ✓        | sk_live_... or sk_test_...           |
| STRIPE_WEBHOOK_SECRET   | ✓        | whsec_...                            |
| FRONTEND_URL            | ✓        | CORS origin e.g. https://veramed.health |
| AI_MODEL                | Optional | Default: claude-sonnet-4-20250514   |
| BCRYPT_ROUNDS           | Optional | Default: 12                          |
| S3_URL_EXPIRY_SECONDS   | Optional | Default: 900 (15 min)                |
