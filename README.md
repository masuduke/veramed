# VeraMed — AI-Assisted Healthcare Platform

> AI-Assisted. Doctor Verified. Delivered to Your Door.

## Architecture Overview

```
veramed/
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── auth/          # JWT + RBAC auth
│   │   ├── routes/        # All API endpoints
│   │   ├── middleware/     # Auth, validation, audit
│   │   ├── services/      # Business logic
│   │   ├── models/        # Prisma ORM models
│   │   └── utils/         # Helpers, encryption, S3
│   ├── prisma/            # DB schema + migrations
│   └── package.json
│
├── frontend/              # Next.js 14 App Router
│   ├── src/
│   │   ├── app/           # Pages (role-based routes)
│   │   ├── components/    # UI + role-specific components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # API client, auth helpers
│   └── package.json
│
├── docs/                  # API docs, compliance notes
└── scripts/               # DB seed, deployment
```

## Tech Stack

| Layer        | Technology                         |
|--------------|------------------------------------|
| Frontend     | Next.js 14, Tailwind CSS, shadcn/ui|
| Backend      | Node.js, Express, Prisma ORM       |
| Database     | PostgreSQL 15                      |
| Auth         | JWT + Refresh Tokens, RBAC         |
| File Storage | AWS S3 (signed URLs)               |
| AI           | OpenAI GPT-4o / Anthropic Claude   |
| Payments     | Stripe                             |
| Cache        | Redis                              |
| Deployment   | Docker + AWS ECS / Railway         |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/veramed
cd veramed

# 2. Environment setup
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Start with Docker
docker-compose up -d

# 4. Run migrations
cd backend && npx prisma migrate deploy && npx prisma db seed

# 5. Start dev servers
# Backend: http://localhost:4000
# Frontend: http://localhost:3000
```

## Core Security Principles

- **AI NEVER prescribes** — suggestions only, doctor approval mandatory
- All medical data encrypted at rest (AES-256)
- S3 signed URLs (15-min expiry) for report access
- Full audit log on every prescription event
- HIPAA-aligned data handling throughout
