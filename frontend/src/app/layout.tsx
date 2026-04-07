// src/app/layout.tsx — Root Layout
import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'VeraMed — AI-Assisted Healthcare',
  description: 'AI-Assisted. Doctor Verified. Delivered to Your Door.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// ──────────────────────────────────────────────
// FILE STRUCTURE MAP
// ──────────────────────────────────────────────
/*
src/app/
├── layout.tsx                  ← Root layout (this file)
├── globals.css
├── page.tsx                    ← Landing page (public)
│
├── (auth)/                     ← Auth group (no sidebar)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── verify-email/page.tsx
│
├── (dashboard)/                ← Authenticated group (with sidebar)
│   ├── layout.tsx              ← Dashboard shell + RBAC redirect
│   │
│   ├── patient/
│   │   ├── page.tsx            ← Patient home / overview
│   │   ├── upload/page.tsx     ← Upload medical report
│   │   ├── reports/
│   │   │   ├── page.tsx        ← Report list
│   │   │   └── [id]/page.tsx   ← Report detail + AI status
│   │   ├── prescriptions/
│   │   │   ├── page.tsx        ← Prescription list
│   │   │   └── [id]/
│   │   │       ├── page.tsx    ← Prescription detail
│   │   │       └── order/page.tsx ← Place order
│   │   └── orders/
│   │       ├── page.tsx        ← Order history
│   │       └── [id]/page.tsx   ← Order tracking
│   │
│   ├── doctor/
│   │   ├── page.tsx            ← Doctor dashboard stats
│   │   ├── cases/
│   │   │   ├── page.tsx        ← Pending case queue
│   │   │   └── [id]/page.tsx   ← Case review (approve/reject)
│   │   └── history/page.tsx    ← Prescription history
│   │
│   ├── pharmacy/
│   │   ├── page.tsx            ← Pharmacy overview
│   │   ├── inventory/
│   │   │   ├── page.tsx        ← Medication list
│   │   │   └── add/page.tsx    ← Add medication
│   │   └── orders/page.tsx     ← Incoming orders
│   │
│   └── driver/
│       ├── page.tsx            ← Driver dashboard
│       └── deliveries/page.tsx ← Active deliveries
│
└── api/                        ← Next.js API routes (thin proxy)
    └── [...path]/route.ts      ← Forward to backend
*/
