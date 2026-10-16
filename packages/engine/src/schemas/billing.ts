import { z } from 'zod';
import { ORDER_STATUSES } from '../billing/billing.js';

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const billingPackageSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  /** Keterangan singkat di kartu paket (opsional). */
  description: z.string().max(300).optional(),
  /** Masa aktif dalam hari; null berarti selamanya. */
  durationDays: z.number().int().min(1).nullable(),
  /** Harga sebelum potongan (dicoret). */
  listPrice: z.number().int().min(0),
  price: z.number().int().min(0),
  active: z.boolean(),
  sort: z.number().int(),
});
export type BillingPackage = z.infer<typeof billingPackageSchema>;

export const paymentMethodSchema = z.object({
  id: z.string(),
  kind: z.enum(['bank', 'ewallet']),
  name: z.string().min(1).max(40),
  number: z.string().min(3).max(40),
  holder: z.string().min(1).max(60),
  /** Petunjuk transfer tambahan untuk orang tua (opsional). */
  instructions: z.string().max(300).optional(),
  active: z.boolean(),
  sort: z.number().int(),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/** Membuat atau mengubah paket dari panel admin. Harga jual tidak boleh melebihi harga normal. */
export const packageInputSchema = z
  .object({
    name: z.string().trim().min(3).max(40),
    description: z.string().trim().max(300),
    durationDays: z.number().int().min(1).max(3650).nullable(),
    listPrice: z.number().int().min(1000).max(100_000_000),
    price: z.number().int().min(1000).max(100_000_000),
    active: z.boolean(),
    sort: z.number().int().min(0).max(999),
  })
  .refine((p) => p.price <= p.listPrice, {
    message: 'harga jual tidak boleh melebihi harga normal',
    path: ['price'],
  });
export type PackageInput = z.infer<typeof packageInputSchema>;

/** Membuat atau mengubah rekening dan e-wallet tujuan transfer. */
export const paymentMethodInputSchema = z.object({
  kind: z.enum(['bank', 'ewallet']),
  name: z.string().trim().min(2).max(40),
  number: z.string().trim().min(4).max(40),
  holder: z.string().trim().min(2).max(60),
  instructions: z.string().trim().max(300),
  active: z.boolean(),
  sort: z.number().int().min(0).max(999),
});
export type PaymentMethodInput = z.infer<typeof paymentMethodInputSchema>;

export const billingContentSchema = z.object({
  adminWhatsapp: z.string().regex(/^\d{8,15}$/),
  packages: z.array(billingPackageSchema).min(1),
  methods: z.array(paymentMethodSchema).min(1),
});
export type BillingContent = z.infer<typeof billingContentSchema>;

export const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  packageId: z.string(),
  packageName: z.string(),
  durationDays: z.number().int().nullable(),
  listPrice: z.number().int(),
  discount: z.number().int(),
  price: z.number().int(),
  uniqueCode: z.number().int(),
  total: z.number().int(),
  methodId: z.string(),
  methodName: z.string(),
  methodNumber: z.string(),
  methodHolder: z.string(),
  status: orderStatusSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  proofName: z.string().nullable(),
  proofAt: z.string().nullable(),
  rejectNote: z.string().nullable(),
  paidAt: z.string().nullable(),
});
export type Order = z.infer<typeof orderSchema>;

export const createOrderBodySchema = z.object({ packageId: z.string(), methodId: z.string() });
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

export const uploadProofBodySchema = z.object({
  fileName: z.string().trim().min(1).max(120),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z
    .number()
    .int()
    .min(1)
    .max(3 * 1024 * 1024),
  dataUrl: z.string().min(10),
});
export type UploadProofBody = z.infer<typeof uploadProofBodySchema>;

export const adminOrderSchema = orderSchema.extend({
  parentName: z.string(),
  parentEmail: z.string(),
  proofDataUrl: z.string().nullable(),
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;

export const rejectOrderBodySchema = z.object({ note: z.string().trim().min(1).max(200) });
export const updatePackageBodySchema = billingPackageSchema
  .pick({ name: true, listPrice: true, price: true, active: true })
  .partial();
export type UpdatePackageBody = z.infer<typeof updatePackageBodySchema>;
export const updateMethodBodySchema = paymentMethodSchema
  .pick({ name: true, number: true, holder: true, active: true })
  .partial();
export type UpdateMethodBody = z.infer<typeof updateMethodBodySchema>;

// ---- Akun orang tua ----

export const parentAccountSchema = z.object({
  name: z.string(),
  email: z.string(),
  familyCode: z.string(),
  passwordChangedAt: z.string().nullable(),
  pendingEmail: z.string().nullable(),
});
export type ParentAccount = z.infer<typeof parentAccountSchema>;

export const updateNameBodySchema = z.object({ name: z.string().trim().min(1).max(60) });
export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export const requestEmailBodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  currentPassword: z.string().min(1),
});
export type RequestEmailBody = z.infer<typeof requestEmailBodySchema>;
export const confirmEmailBodySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export const referralSchema = z.object({
  code: z.string(),
  registered: z.number().int(),
  paid: z.number().int(),
});
export type Referral = z.infer<typeof referralSchema>;
