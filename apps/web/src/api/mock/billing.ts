import {
  ORDER_TTL_MS,
  PROOF_TYPES,
  billingPackageSchema,
  createOrderBodySchema,
  effectiveStatus,
  extendPremium,
  needsAction,
  orderAmounts,
  orderNumber,
  paymentMethodSchema,
  rejectOrderBodySchema,
  uniqueCodeFor,
  updateMethodBodySchema,
  updatePackageBodySchema,
  uploadProofBodySchema,
  type AdminOrder,
  type BillingPackage,
  type CreateOrderBody,
  type Order,
  type OrderStatus,
  type PaymentMethod,
  type UpdateMethodBody,
  type UpdatePackageBody,
  type UploadProofBody,
} from '@udakids/engine';
import { BILLING } from '../../content/billing';
import { ApiError } from '../client';
import { parentFromToken } from './accounts';
import { newId, readDb, writeDb, type MockDb, type MockOrder } from './db';
import { adminFromToken } from './staff';

const MAX_OPEN_ORDERS = 3;

const fail = (status: number, code: ApiError['body']['code'], message: string) =>
  new ApiError(status, { code, message });

function packagesOf(db: MockDb): BillingPackage[] {
  return BILLING.packages
    .map((p) => billingPackageSchema.parse({ ...p, ...db.billingEdits.packages[p.id] }))
    .sort((a, b) => a.sort - b.sort);
}

function methodsOf(db: MockDb): PaymentMethod[] {
  return BILLING.methods
    .map((m) => paymentMethodSchema.parse({ ...m, ...db.billingEdits.methods[m.id] }))
    .sort((a, b) => a.sort - b.sort);
}

/** Pesanan untuk klien: status mengikuti waktu, tanpa bukti mentah dan id orang tua. */
function present(o: MockOrder): Order {
  const { parentId: _p, proofDataUrl: _d, ...rest } = o;
  return { ...rest, status: effectiveStatus(o, Date.now()) };
}

export async function packages(token: string | null): Promise<BillingPackage[]> {
  parentFromToken(token);
  return packagesOf(readDb()).filter((p) => p.active);
}

export async function methods(token: string | null): Promise<PaymentMethod[]> {
  parentFromToken(token);
  return methodsOf(readDb()).filter((m) => m.active);
}

export async function orders(token: string | null): Promise<Order[]> {
  const parent = parentFromToken(token);
  return Object.values(readDb().orders)
    .filter((o) => o.parentId === parent.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(present);
}

function ownOrder(token: string | null, id: string) {
  const parent = parentFromToken(token);
  const db = readDb();
  const order = db.orders[id];
  if (!order || order.parentId !== parent.id) throw fail(404, 'NOT_FOUND', 'Pesanan tidak ketemu.');
  return { db, order, parent };
}

export async function order(token: string | null, id: string): Promise<Order> {
  return present(ownOrder(token, id).order);
}

export async function createOrder(token: string | null, body: CreateOrderBody): Promise<Order> {
  const parent = parentFromToken(token);
  const parsed = createOrderBodySchema.safeParse(body);
  if (!parsed.success) throw fail(400, 'VALIDATION', 'Pilih paket dan cara bayar.');
  const db = readDb();
  const pkg = packagesOf(db).find((p) => p.id === parsed.data.packageId && p.active);
  const method = methodsOf(db).find((m) => m.id === parsed.data.methodId && m.active);
  if (!pkg || !method) throw fail(404, 'NOT_FOUND', 'Paket atau cara bayar tidak tersedia.');

  const open = Object.values(db.orders).filter(
    (o) => o.parentId === parent.id && effectiveStatus(o, Date.now()) === 'awaiting_payment',
  );
  if (open.length >= MAX_OPEN_ORDERS)
    throw fail(409, 'CONFLICT', 'Ada 3 pesanan yang belum dibayar. Selesaikan atau batalkan dulu.');

  const now = Date.now();
  const id = newId('o');
  const created: MockOrder = {
    id,
    number: orderNumber(now, id),
    packageId: pkg.id,
    packageName: pkg.name,
    durationDays: pkg.durationDays,
    ...orderAmounts(pkg.listPrice, pkg.price, uniqueCodeFor(id)),
    methodId: method.id,
    methodName: method.name,
    methodNumber: method.number,
    methodHolder: method.holder,
    status: 'awaiting_payment',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ORDER_TTL_MS).toISOString(),
    proofName: null,
    proofAt: null,
    rejectNote: null,
    paidAt: null,
    parentId: parent.id,
    proofDataUrl: null,
  };
  db.orders[id] = created;
  writeDb(db);
  return present(created);
}

export async function uploadProof(
  token: string | null,
  id: string,
  body: UploadProofBody,
): Promise<Order> {
  const { db, order: o } = ownOrder(token, id);
  const parsed = uploadProofBodySchema.safeParse(body);
  if (!parsed.success || !(PROOF_TYPES as readonly string[]).includes(parsed.data.mime))
    throw fail(400, 'VALIDATION', 'Unggah gambar JPG, PNG, atau WEBP maksimal 3 MB.');
  const status = effectiveStatus(o, Date.now());
  if (status !== 'awaiting_payment' && status !== 'rejected')
    throw fail(409, 'CONFLICT', 'Pesanan ini tidak bisa menerima bukti lagi.');
  o.proofName = parsed.data.fileName;
  o.proofDataUrl = parsed.data.dataUrl;
  o.proofAt = new Date().toISOString();
  o.rejectNote = null;
  o.status = 'awaiting_review';
  writeDb(db);
  return present(o);
}

export async function cancelOrder(token: string | null, id: string): Promise<Order> {
  const { db, order: o } = ownOrder(token, id);
  const status = effectiveStatus(o, Date.now());
  if (!needsAction(status)) throw fail(409, 'CONFLICT', 'Pesanan ini tidak bisa dibatalkan.');
  o.status = 'cancelled';
  writeDb(db);
  return present(o);
}

/** Jumlah pesanan yang butuh tindakan, untuk lencana di menu. */
export async function pendingCount(token: string | null): Promise<number> {
  return (await orders(token)).filter((o) => needsAction(o.status)).length;
}

// ---- Admin ----

function adminView(db: MockDb, o: MockOrder): AdminOrder {
  const parent = db.parents.find((p) => p.id === o.parentId);
  return {
    ...present(o),
    parentName: parent?.name ?? '-',
    parentEmail: parent?.email ?? '-',
    proofDataUrl: o.proofDataUrl,
  };
}

export async function adminOrders(
  token: string | null,
  status: OrderStatus | null,
): Promise<AdminOrder[]> {
  adminFromToken(token);
  const db = readDb();
  return Object.values(db.orders)
    .map((o) => adminView(db, o))
    .filter((o) => !status || o.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function adminOrder(token: string | null, id: string) {
  adminFromToken(token);
  const db = readDb();
  const o = db.orders[id];
  if (!o) throw fail(404, 'NOT_FOUND', 'Pesanan tidak ketemu.');
  return { db, o };
}

export async function approveOrder(token: string | null, id: string): Promise<AdminOrder> {
  const { db, o } = adminOrder(token, id);
  if (effectiveStatus(o, Date.now()) !== 'awaiting_review')
    throw fail(409, 'CONFLICT', 'Hanya pesanan dengan bukti terkirim yang bisa disetujui.');
  o.status = 'paid';
  o.paidAt = new Date().toISOString();
  db.familyPremium[o.parentId] = extendPremium(
    db.familyPremium[o.parentId] ?? null,
    o.durationDays,
    Date.now(),
  );
  writeDb(db);
  return adminView(db, o);
}

export async function rejectOrder(
  token: string | null,
  id: string,
  note: string,
): Promise<AdminOrder> {
  const { db, o } = adminOrder(token, id);
  const parsed = rejectOrderBodySchema.safeParse({ note });
  if (!parsed.success) throw fail(400, 'VALIDATION', 'Tulis alasan singkat untuk orang tua.');
  if (effectiveStatus(o, Date.now()) !== 'awaiting_review')
    throw fail(409, 'CONFLICT', 'Hanya pesanan dengan bukti terkirim yang bisa ditolak.');
  o.status = 'rejected';
  o.rejectNote = parsed.data.note;
  writeDb(db);
  return adminView(db, o);
}

export async function adminPackages(token: string | null): Promise<BillingPackage[]> {
  adminFromToken(token);
  return packagesOf(readDb());
}

export async function updatePackage(
  token: string | null,
  id: string,
  body: UpdatePackageBody,
): Promise<BillingPackage> {
  adminFromToken(token);
  const db = readDb();
  if (!BILLING.packages.some((p) => p.id === id))
    throw fail(404, 'NOT_FOUND', 'Paket tidak ketemu.');
  const parsed = updatePackageBodySchema.safeParse(body);
  if (!parsed.success) throw fail(400, 'VALIDATION', 'Periksa lagi nama dan harga paket.');
  const next = { ...db.billingEdits.packages[id], ...parsed.data };
  const merged = packagesOf({
    ...db,
    billingEdits: { ...db.billingEdits, packages: { ...db.billingEdits.packages, [id]: next } },
  }).find((p) => p.id === id)!;
  if (merged.price > merged.listPrice)
    throw fail(400, 'VALIDATION', 'Harga jual tidak boleh melebihi harga coret.');
  db.billingEdits.packages[id] = next;
  writeDb(db);
  return merged;
}

export async function adminMethods(token: string | null): Promise<PaymentMethod[]> {
  adminFromToken(token);
  return methodsOf(readDb());
}

export async function updateMethod(
  token: string | null,
  id: string,
  body: UpdateMethodBody,
): Promise<PaymentMethod> {
  adminFromToken(token);
  const db = readDb();
  if (!BILLING.methods.some((m) => m.id === id))
    throw fail(404, 'NOT_FOUND', 'Cara bayar tidak ketemu.');
  const parsed = updateMethodBodySchema.safeParse(body);
  if (!parsed.success) throw fail(400, 'VALIDATION', 'Periksa lagi nomor dan atas nama.');
  db.billingEdits.methods[id] = { ...db.billingEdits.methods[id], ...parsed.data };
  writeDb(db);
  return methodsOf(db).find((m) => m.id === id)!;
}
