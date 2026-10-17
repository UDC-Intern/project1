import { beforeEach, describe, expect, it } from 'vitest';
import {
  billingPackageSchema,
  certificateSchema,
  effectiveStatus,
  illustrationSchema,
  orderSchema,
  paymentMethodSchema,
} from '@udakids/engine';
import type { AdminDashboard, ChildRow, FamilyRow, Page, StaffUser } from '../src/api/adminTypes';
import { childLogin, familyProfiles, parentLogin, staffLogin } from '../src/api/auth';
import { handle } from '../src/api/mock/adminRoutes';
import { bookProgress } from '../src/api/mock/certificate';
import { BOOKS, premiumUntilOf, readDb, resetMockDb, type MockDb } from '../src/api/mock/db';
import {
  addDemoData,
  clearDemoData,
  demoSummary,
  ensureDemoData,
  isDemoId,
  reloadDemoData,
  removeDemoData,
} from '../src/api/mock/demoData';
import { findLevel } from '../src/api/mock/levels';

const NOW = Date.now();
const adm = <T>(path: string) => handle<T>(path, 'GET', undefined, 'mock-admin:a-demo');

beforeEach(() => {
  resetMockDb();
});

function seeded(): MockDb {
  const db = readDb();
  addDemoData(db, NOW);
  return db;
}

describe('data contoh mode tiruan', () => {
  it('mengisi setiap tabel dengan puluhan baris yang saling terhubung', () => {
    const db = seeded();
    const { loaded, counts } = demoSummary(db);
    expect(loaded).toBe(true);
    expect(counts.families).toBeGreaterThanOrEqual(45);
    expect(counts.children).toBeGreaterThanOrEqual(60);
    expect(counts.staff).toBe(31);
    expect(counts.orders).toBeGreaterThanOrEqual(60);
    expect(counts.rounds).toBeGreaterThanOrEqual(800);
    expect(counts.certificates).toBeGreaterThanOrEqual(10);
    expect(counts.illustrations).toBe(32);
    expect(counts.grants).toBeGreaterThanOrEqual(25);

    const parents = new Set(db.parents.map((p) => p.id));
    const kids = new Set(db.children.map((c) => c.id));
    for (const c of db.children) expect(parents.has(c.parentId)).toBe(true);
    for (const o of Object.values(db.orders)) expect(parents.has(o.parentId)).toBe(true);
    for (const g of db.premiumGrants) expect(kids.has(g.childId)).toBe(true);
    for (const r of Object.values(db.rounds)) {
      expect(kids.has(r.childId)).toBe(true);
      expect(findLevel(r.levelId)).not.toBeNull();
      expect(Object.keys(r.answers)).toHaveLength(10);
      expect(r.finishedAt!).toBeLessThanOrEqual(NOW);
    }
    // Sertifikat hanya untuk anak yang lulus semua level bukunya.
    for (const c of Object.values(db.certificates)) {
      const book = BOOKS.find((b) => b.slug === c.bookSlug)!;
      expect(bookProgress(db, c.childId, book).levelsPassed).toBe(c.levels);
    }
  });

  it('isinya lolos skema, semua status pesanan terwakili, dan halaman depan tidak berubah', () => {
    const db = seeded();
    const orders = Object.values(db.orders).filter((o) => isDemoId(o.id));
    for (const { parentId: _p, proofDataUrl: _d, ...o } of orders)
      expect(orderSchema.safeParse(o).success).toBe(true);
    expect(new Set(orders.map((o) => effectiveStatus(o, NOW)))).toEqual(
      new Set(['paid', 'awaiting_review', 'awaiting_payment', 'rejected', 'expired', 'cancelled']),
    );
    for (const o of orders.filter((x) => x.status === 'awaiting_review'))
      expect(o.proofDataUrl).toMatch(/^data:image\/svg\+xml;/);
    for (const i of db.illustrations) expect(illustrationSchema.safeParse(i).success).toBe(true);
    for (const c of Object.values(db.certificates))
      expect(certificateSchema.safeParse(c).success).toBe(true);
    for (const p of db.packages) expect(billingPackageSchema.safeParse(p).success).toBe(true);
    for (const m of db.methods) expect(paymentMethodSchema.safeParse(m).success).toBe(true);
    expect(db.packages.filter((p) => isDemoId(p.id) && p.active)).toHaveLength(0);
    expect(db.methods.filter((m) => isDemoId(m.id) && m.active)).toHaveLength(0);
  });

  it('selalu sama untuk waktu yang sama dan muat di penyimpanan peramban', () => {
    const first = JSON.stringify(seeded());
    resetMockDb();
    expect(JSON.stringify(seeded())).toBe(first);
    expect(first.length).toBeLessThan(3_500_000);
  });

  it('dihapus tanpa menyentuh data buatan sendiri', () => {
    const base = JSON.stringify(readDb());
    const db = seeded();
    removeDemoData(db);
    delete db.demo;
    expect(JSON.stringify(db)).toBe(base);
  });

  it('dimuat sekali per versi dan tidak kembali setelah dihapus admin', () => {
    ensureDemoData(NOW);
    const first = demoSummary();
    ensureDemoData(NOW);
    expect(demoSummary()).toEqual(first);
    expect(clearDemoData().loaded).toBe(false);
    ensureDemoData(NOW);
    expect(demoSummary().loaded).toBe(false);
    expect(reloadDemoData(NOW).counts).toEqual(first.counts);
  });

  it('panel admin: daftar panjang dibagi per halaman dan Ringkasan terisi', async () => {
    ensureDemoData(NOW);
    const fam = await adm<Page<FamilyRow>>('/admin/directory/families?page=2&pageSize=20');
    expect(fam.total).toBeGreaterThanOrEqual(45);
    expect(fam.items).toHaveLength(20);
    const kids = await adm<Page<ChildRow>>('/admin/directory/children?page=3&pageSize=10');
    expect(kids.total).toBeGreaterThanOrEqual(60);
    expect(kids.items).toHaveLength(10);
    expect(await adm<StaffUser[]>('/admin/staff')).toHaveLength(32);
    const dash = await adm<AdminDashboard>('/admin/dashboard?range=30d');
    expect(dash.rounds).toBeGreaterThan(100);
    expect(dash.counts.pendingOrders).toBeGreaterThan(0);
    expect(dash.counts.waitingCertificates).toBeGreaterThan(0);
    expect(dash.counts.illustrationsToReview).toBe(8);
  });

  it('akun contoh di README bisa masuk: orang tua, staf, dan anak keluarga CERDAS', async () => {
    ensureDemoData(NOW);
    const parent = await parentLogin({
      email: 'rina.kusumawati@example.com',
      password: 'rahasia123',
    });
    expect(parent.user.name).toBe('Rina Kusumawati');
    const staff = await staffLogin({
      email: 'nadia.paramitha@udakids.local',
      password: 'staf12345',
    });
    expect(staff.user.role).toBe('admin');
    const db = readDb();
    const orders = Object.values(db.orders).filter((o) => o.parentId === 'demo-p-00');
    expect(orders.length).toBeGreaterThan(10);

    const { profiles } = await familyProfiles('cerdas');
    expect(profiles.map((p) => p.nickname)).toEqual(['Nara', 'Sakti', 'Lili']);
    const nara = profiles.find((p) => p.nickname === 'Nara')!;
    const login = await childLogin({ childId: nara.id, pin: ['apple', 'star', 'fish'] });
    expect(login.token).toContain(nara.id);
    expect(premiumUntilOf(db, nara.id)).not.toBeNull();
    expect(
      Object.values(db.certificates).some(
        (c) => c.childId === nara.id && c.bookSlug === 'matematika-kelas-1',
      ),
    ).toBe(true);
  });
});
