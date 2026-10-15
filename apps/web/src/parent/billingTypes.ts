import type { Access, OrderStatus, Pricing } from '@udakids/engine';

/** Bentuk respons API pembayaran orang tua (apps/api/src/billing/parent-billing.controller.ts). */

export type BookRef = { domain: string; grade: string };

export type BillingPackage = {
  id: string;
  name: string;
  description: string;
  scope: 'all' | 'books';
  books: BookRef[];
  /** `null` = selamanya. */
  durationDays: number | null;
  pricing: Pricing;
  discountEndsAt: string | null;
};

export type PaymentMethod = {
  id: string;
  kind: 'bank' | 'ewallet';
  provider: string;
  accountNumber: string;
  accountName: string;
  instructions: string;
};

export type Entitlement = {
  id: string;
  name: string;
  scope: 'all' | 'books';
  books: BookRef[];
  startsAt: string;
  endsAt: string | null;
};

export type BillingOverview = {
  packages: BillingPackage[];
  methods: PaymentMethod[];
  entitlements: Entitlement[];
  access: Access;
  settings: { paywall: boolean; freeLevels: number; orderExpiryHours: number };
};

export type Order = {
  id: string;
  number: string;
  packageId: string | null;
  packageSnapshot: {
    name: string;
    scope: 'all' | 'books';
    books: BookRef[];
    durationDays: number | null;
  };
  methodSnapshot: Omit<PaymentMethod, 'id'>;
  priceNormal: number;
  discount: number;
  uniqueCode: number;
  /** Total yang ditransfer = harga akhir + kode unik (rupiah bulat). */
  amount: number;
  status: OrderStatus;
  expiresAt: string;
  proofMime: string | null;
  proofAt: string | null;
  reviewedAt?: string | null;
  /** Alasan penolakan bukti (status `rejected`). */
  note: string | null;
  createdAt: string;
};
