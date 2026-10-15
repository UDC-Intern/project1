import { billingContentSchema } from '@udakids/engine';
import raw from '../../../../content/billing.json';

/** Paket dan rekening awal dari `content/billing.json` (sumber yang sama dengan seed database). */
export const BILLING = billingContentSchema.parse(raw);
