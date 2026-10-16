import {
  PROOF_TYPES,
  createOrderBodySchema,
  effectiveStatus,
  extendPremium,
  needsAction,
  orderAmounts,
  orderNumber,
  packageInputSchema,
  paymentMethodInputSchema,
  rejectOrderBodySchema,
  uniqueCodeFor,
  uploadProofBodySchema,
  type AdminOrder,
  type BillingPackage,
  type CreateOrderBody,
  type Order,
  type OrderStatus,
  type PackageInput,
  type PaymentMethod,
  type PaymentMethodInput,
  type UpdateMethodBody,
  type UpdatePackageBody,
  type UploadProofBody,
} from '@udakids/engine';
import { ApiError } from '../client';
import { parentFromToken } from './accounts';
import { newId, readDb, writeDb, type MockDb, type MockOrder } from './db';
import { adminFromToken } from './staff';

const MAX_OPEN_ORDERS = 3;

const fail = (status: number, code: ApiError['body']['code'], message: string) =>
  new ApiError(status, { code, message });

export const packagesOf = (db: MockDb): BillingPackage[] =>
  [...db.packages].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

export const methodsOf = (db: MockDb): PaymentMethod[] =>
  [...db.methods].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

const HOUR_MS = 60 * 60 * 1000;

/** Pesanan untuk klien: status mengikuti waktu, tanpa bukti mentah dan id orang tua. */
function present(o: MockOrder): Order {
  const { parentId: _p, proofDataUrl: _d, ...rest } = o;
  return { ...rest, status: effectiveStatus(o, Date.now()) };
}

/** `GET /packages` (publik): paket aktif untuk halaman depan. */
export async function publicPackages(): Promise<BillingPackage[]> {
  return packagesOf(readDb()).filter((p) => p.active);
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
    expiresAt: new Date(now + db.settings.billing.orderExpiryHours * HOUR_MS).toISOString(),
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

/** Bisa disetujui selama belum lunas atau dibatalkan, mis. bukti dikirim lewat WhatsApp. */
const APPROVABLE: readonly OrderStatus[] = [
  'awaiting_review',
  'awaiting_payment',
  'expired',
  'rejected',
];
const REJECTABLE: readonly OrderStatus[] = ['awaiting_review', 'awaiting_payment'];

export async function approveOrder(token: string | null, id: string): Promise<AdminOrder> {
  const { db, o } = adminOrder(token, id);
  if (!APPROVABLE.includes(effectiveStatus(o, Date.now())))
    throw fail(409, 'CONFLICT', 'Pesanan ini sudah lunas atau dibatalkan.');
  o.status = 'paid';
  o.paidAt = new Date().toISOString();
  o.rejectNote = null;
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
  if (!REJECTABLE.includes(effectiveStatus(o, Date.now())))
    throw fail(
      409,
      'CONFLICT',
      'Hanya pesanan yang menunggu pembayaran atau verifikasi yang bisa ditolak.',
    );
  o.status = 'rejected';
  o.rejectNote = parsed.data.note;
  writeDb(db);
  return adminView(db, o);
}

/** Jumlah pesanan yang menunggu verifikasi admin (lencana menu Transaksi). */
export async function awaitingReviewCount(token: string | null): Promise<number> {
  adminFromToken(token);
  return Object.values(readDb().orders).filter(
    (o) => effectiveStatus(o, Date.now()) === 'awaiting_review',
  ).length;
}

// ---- Admin: paket ----

export type AdminPackage = BillingPackage & { sold: number };

const soldCount = (db: MockDb, packageId: string) =>
  Object.values(db.orders).filter((o) => o.packageId === packageId && o.status === 'paid').length;

export async function adminPackages(token: string | null): Promise<AdminPackage[]> {
  adminFromToken(token);
  const db = readDb();
  return packagesOf(db).map((p) => ({ ...p, sold: soldCount(db, p.id) }));
}

type Issue = { code: string; path: PropertyKey[] };

/** Galat isian dengan daftar isian yang keliru, supaya formulir bisa menandai isiannya. */
function inputError(message: string, issues: readonly Issue[]) {
  return new ApiError(
    400,
    { code: 'VALIDATION', message },
    issues.map((i) => ({ path: i.path.map(String).join('.'), message })),
  );
}

/** Harga jual di atas harga normal punya pesan sendiri; galat lain memakai pesan umum. */
const packageError = (issues: readonly Issue[]) =>
  inputError(
    issues.some((i) => i.code === 'custom' && i.path[0] === 'price')
      ? 'Harga jual tidak boleh melebihi harga normal.'
      : 'Periksa lagi nama, harga normal, dan harga jual paket.',
    issues,
  );

/** Id paket dari namanya, mis. "Paket Hemat" menjadi "paket-hemat"; ditambah angka bila sudah dipakai. */
function packageId(db: MockDb, name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'paket';
  let id = base;
  for (let n = 2; db.packages.some((p) => p.id === id); n++) id = `${base}-${n}`;
  return id;
}

export async function createPackage(
  token: string | null,
  body: PackageInput,
): Promise<AdminPackage> {
  adminFromToken(token);
  const parsed = packageInputSchema.safeParse(body);
  if (!parsed.success) throw packageError(parsed.error.issues);
  const db = readDb();
  const created: BillingPackage = { id: packageId(db, parsed.data.name), ...parsed.data };
  db.packages.push(created);
  writeDb(db);
  return { ...created, sold: 0 };
}

/** Mengubah paket. Body boleh sebagian; hasil gabungan diperiksa ulang. */
export async function updatePackage(
  token: string | null,
  id: string,
  body: UpdatePackageBody | Partial<PackageInput>,
): Promise<AdminPackage> {
  adminFromToken(token);
  const db = readDb();
  const current = db.packages.find((p) => p.id === id);
  if (!current) throw fail(404, 'NOT_FOUND', 'Paket tidak ketemu.');
  const { id: _id, ...rest } = current;
  const parsed = packageInputSchema.safeParse({ description: '', ...rest, ...body });
  if (!parsed.success) throw packageError(parsed.error.issues);
  Object.assign(current, parsed.data);
  writeDb(db);
  return { ...current, sold: soldCount(db, id) };
}

/** Paket yang pernah dipesan hanya dinonaktifkan, supaya riwayat pesanan tetap utuh. */
export async function deletePackage(
  token: string | null,
  id: string,
): Promise<{ deleted: boolean; deactivated: boolean }> {
  adminFromToken(token);
  const db = readDb();
  const current = db.packages.find((p) => p.id === id);
  if (!current) throw fail(404, 'NOT_FOUND', 'Paket tidak ketemu.');
  if (Object.values(db.orders).some((o) => o.packageId === id)) {
    current.active = false;
    writeDb(db);
    return { deleted: false, deactivated: true };
  }
  db.packages = db.packages.filter((p) => p.id !== id);
  writeDb(db);
  return { deleted: true, deactivated: false };
}

// ---- Admin: rekening dan e-wallet ----

export async function adminMethods(token: string | null): Promise<PaymentMethod[]> {
  adminFromToken(token);
  return methodsOf(readDb());
}

const methodError = (issues: readonly Issue[]) =>
  inputError('Periksa lagi nama bank, nomor, dan atas nama rekening.', issues);

export async function createMethod(
  token: string | null,
  body: PaymentMethodInput,
): Promise<PaymentMethod> {
  adminFromToken(token);
  const parsed = paymentMethodInputSchema.safeParse(body);
  if (!parsed.success) throw methodError(parsed.error.issues);
  const db = readDb();
  const created: PaymentMethod = { id: newId('m'), ...parsed.data };
  db.methods.push(created);
  writeDb(db);
  return created;
}

/** Mengubah rekening. Body boleh sebagian; hasil gabungan diperiksa ulang. */
export async function updateMethod(
  token: string | null,
  id: string,
  body: UpdateMethodBody | Partial<PaymentMethodInput>,
): Promise<PaymentMethod> {
  adminFromToken(token);
  const db = readDb();
  const current = db.methods.find((m) => m.id === id);
  if (!current) throw fail(404, 'NOT_FOUND', 'Cara bayar tidak ketemu.');
  const { id: _id, ...rest } = current;
  const parsed = paymentMethodInputSchema.safeParse({ instructions: '', ...rest, ...body });
  if (!parsed.success) throw methodError(parsed.error.issues);
  Object.assign(current, parsed.data);
  writeDb(db);
  return current;
}

/** Rekening dihapus; pesanan lama tetap menyimpan salinan nomor dan atas nama. */
export async function deleteMethod(token: string | null, id: string): Promise<void> {
  adminFromToken(token);
  const db = readDb();
  if (!db.methods.some((m) => m.id === id))
    throw fail(404, 'NOT_FOUND', 'Cara bayar tidak ketemu.');
  db.methods = db.methods.filter((m) => m.id !== id);
  writeDb(db);
}
