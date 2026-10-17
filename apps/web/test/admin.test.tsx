import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminWhatsappHref, type AppSettings, type Illustration } from '@udakids/engine';
import { catalog, overview, preview } from '../src/api/admin';
import type {
  AdminChildReport,
  AdminDashboard,
  CatalogBook,
  ChildRow,
  ChildSummaryRow,
  DirectorySummary,
  FamilyRow,
  Grant,
  LevelStat,
  Page,
  PackageRow,
  StaffUser,
} from '../src/api/adminTypes';
import { childLogin, parentLogin, staffLogin } from '../src/api/auth';
import { createOrder, methods, packages, publicPackages, uploadProof } from '../src/api/billing';
import { book, topic } from '../src/api/catalog';
import { ApiError } from '../src/api/client';
import { handle } from '../src/api/mock/adminRoutes';
import { BOOKS, readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { plan } from '../src/api/parent';
import { startRound } from '../src/api/practice';
import { useSession } from '../src/auth/store';
import { AdminLayout } from '../src/admin/AdminLayout';
import { OrdersPage } from '../src/admin/billing/OrdersPage';
import { SettingsPage } from '../src/admin/billing/SettingsPage';
import { CertificatesPage } from '../src/admin/content/CertificatesPage';
import { SimulatorPage } from '../src/admin/content/SimulatorPage';
import { GalleryPage } from '../src/admin/media/GalleryPage';
import { IllustrationsPage } from '../src/admin/media/IllustrationsPage';
import { NarrationPage } from '../src/admin/media/NarrationPage';
import { DashboardPage } from '../src/admin/overview/DashboardPage';
import { CatalogPage } from '../src/admin/catalog/CatalogPage';
import { FamiliesPage } from '../src/admin/users/FamiliesPage';
import { Landing } from '../src/site/Landing';
import { StaffLogin } from '../src/staff/StaffLogin';

const AYU = 'c-ayu';
const AYU_PIN = ['apple', 'star', 'fish'] as const;
const ADMIN = 'mock-admin:a-demo';

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('seharusnya gagal');
}

/** Rute panel admin di mode tiruan, sama seperti yang dipanggil halaman admin. */
const adm = <T,>(
  path: string,
  method = 'GET',
  body?: Record<string, unknown>,
  token: string | null = ADMIN,
) => handle<T>(path, method, body, token);

const asAdmin = () =>
  useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
const asAyu = () =>
  useSession.setState({ session: { token: `mock-child:${AYU}`, role: 'child', name: 'Ayu' } });
const asParent = () =>
  useSession.setState({
    session: { token: 'mock-parent:p-demo', role: 'parent', name: 'Ridho Dwi Syahputra' },
  });

/** Ayu sudah lulus level 1 dan 2 topik pertama, jadi level 3 tinggal menunggu syarat gratis/Premium. */
function passFirstTwoLevels() {
  const db = readDb();
  db.passedLevels[AYU] = ['matematika-kelas-1:A:1', 'matematika-kelas-1:A:2'];
  writeDb(db);
}

const PACKAGE = {
  name: 'Paket Sekolah',
  description: 'Untuk kelas mitra.',
  durationDays: 90,
  listPrice: 50000,
  price: 45000,
  active: true,
  sort: 5,
};

beforeEach(() => {
  resetMockDb();
  asAdmin();
});

describe('mock admin: akses', () => {
  it('masuk staf menerima admin, menolak akun orang tua dan kata sandi keliru', async () => {
    const res = await staffLogin({ email: 'admin@udakids.local', password: 'admin12345' });
    expect(res.user.role).toBe('admin');
    expect(
      (await errorOf(staffLogin({ email: 'ridhodwi330@gmail.com', password: 'rahasia123' }))).body
        .code,
    ).toBe('INVALID_CREDENTIALS');
    expect(
      (await errorOf(parentLogin({ email: 'admin@udakids.local', password: 'admin12345' }))).status,
    ).toBe(401);
  });

  it('rute admin menolak tanpa token (401), peran lain (403), dan alamat asing (404)', async () => {
    expect((await errorOf(adm('/admin/directory/summary', 'GET', undefined, null))).status).toBe(
      401,
    );
    expect(
      (await errorOf(adm('/admin/settings', 'GET', undefined, 'mock-parent:p-demo'))).status,
    ).toBe(403);
    expect(
      (await errorOf(adm('/admin/orders', 'GET', undefined, `mock-child:${AYU}`))).status,
    ).toBe(403);
    expect((await errorOf(adm('/admin/tidak-ada'))).status).toBe(404);
    useSession.setState({ session: null });
    expect((await errorOf(overview())).status).toBe(401);
  });
});

describe('mock admin: konten', () => {
  it('judul, materi, dan "Tahukah kamu?" topik langsung terlihat anak', async () => {
    const books = await adm<CatalogBook[]>('/admin/topics/matematika-kelas-1:A', 'PATCH', {
      title: 'Berhitung sampai 100',
      lesson: 'Hitung benda satu per satu.',
      tips: ['Hitung sambil menunjuk bendanya.'],
    });
    expect(books[0]!.topics[0]).toMatchObject({
      title: 'Berhitung sampai 100',
      tips: ['Hitung sambil menunjuk bendanya.'],
    });
    asAyu();
    const t = await topic('matematika-kelas-1:A');
    expect(t.topic.title).toBe('Berhitung sampai 100');
    expect(t.topic.lesson).toBe('Hitung benda satu per satu.');
    expect((await book('matematika-kelas-1')).topics[0]!.tips).toEqual([
      'Hitung sambil menunjuk bendanya.',
    ]);
  });

  it('materi atau hal penting berkata terlarang ditolak, topik tidak dikenal 404', async () => {
    const path = '/admin/topics/matematika-kelas-1:A';
    expect((await errorOf(adm(path, 'PATCH', { lesson: 'Jawabanmu salah.' }))).status).toBe(400);
    expect((await errorOf(adm(path, 'PATCH', { tips: ['Jawabanmu salah.'] }))).status).toBe(400);
    expect((await errorOf(adm('/admin/topics/tidak:ada', 'PATCH', { title: 'x' }))).status).toBe(
      404,
    );
  });

  it('pengecualian gratis per level membuka level 3, dan hilang bila sama dengan aturan', async () => {
    let books = await adm<CatalogBook[]>('/admin/levels/matematika-kelas-1:A:3', 'PATCH', {
      free: true,
    });
    expect(books[0]!.topics[0]!.levels[2]).toMatchObject({ free: true, override: true });
    passFirstTwoLevels();
    asAyu();
    expect((await topic('matematika-kelas-1:A')).levels[2]!.status).toBe('open');

    asAdmin();
    books = await adm<CatalogBook[]>('/admin/levels/matematika-kelas-1:A:3', 'PATCH', {
      free: false,
    });
    expect(books[0]!.topics[0]!.levels[2]).toMatchObject({ free: false, override: false });
    expect(
      (await errorOf(adm('/admin/levels/matematika-kelas-1:A:1', 'PATCH', { free: false }))).status,
    ).toBe(400);
  });

  it('judul level bertahan setelah katalog dibaca ulang', async () => {
    await adm('/admin/levels/sains-kelas-1:A:3', 'PATCH', { title: 'Merawat gigi' });
    const cat = await adm<CatalogBook[]>('/admin/catalogs');
    expect(cat[1]!.topics[0]!.levels[2]!.title).toBe('Merawat gigi');
    expect(BOOKS[1]!.topics[0]!.levels[2]!.title).toBe('Merawat gigi');
    expect((await catalog()).books[1]!.topics[0]!.levels[2]!.title).toBe('Merawat gigi');
  });
});

describe('mock admin: pengaturan dinamis', () => {
  it('batas level gratis dan kunci berbayar dari Pengaturan berlaku untuk anak', async () => {
    passFirstTwoLevels();
    asAyu();
    expect((await errorOf(startRound('matematika-kelas-1:A:3'))).body.code).toBe(
      'PREMIUM_REQUIRED',
    );

    asAdmin();
    await adm('/admin/settings/billing', 'PUT', {
      paywall: true,
      freeLevels: 3,
      orderExpiryHours: 24,
    });
    asAyu();
    expect((await topic('matematika-kelas-1:A')).levels[2]!.status).toBe('open');
    expect((await startRound('matematika-kelas-1:A:3')).questions).toHaveLength(10);

    asAdmin();
    const cat = await adm<CatalogBook[]>('/admin/catalogs');
    expect(cat[0]!.topics[0]!.levels.map((l) => l.free)).toEqual(
      cat[0]!.topics[0]!.levels.map((l) => l.number <= 3),
    );
    await adm('/admin/settings/billing', 'PUT', {
      paywall: false,
      freeLevels: 1,
      orderExpiryHours: 24,
    });
    expect(
      (await adm<CatalogBook[]>('/admin/catalogs'))[0]!.topics[0]!.levels.every((l) => l.free),
    ).toBe(true);
  });

  it('isian keliru ditolak per isian; bagian tidak dikenal 404', async () => {
    const e = await errorOf(
      adm('/admin/settings/billing', 'PUT', { paywall: true, freeLevels: 0, orderExpiryHours: 24 }),
    );
    expect(e.status).toBe(400);
    expect(e.issues[0]?.path).toBe('freeLevels');
    expect((await errorOf(adm('/admin/settings/rahasia', 'PUT', {}))).status).toBe(404);
    expect(readDb().settings.billing.freeLevels).toBe(2);
  });

  it('nomor WhatsApp admin dinormalkan; link selain WhatsApp ditolak', async () => {
    const s = await adm<AppSettings>('/admin/settings/contact', 'PUT', {
      adminWhatsapp: '0812-3456-7890',
      adminMessage: 'Halo admin',
      groupWhatsapp: 'https://chat.whatsapp.com/AbCdEf123',
    });
    expect(s.contact.adminWhatsapp).toBe('https://wa.me/6281234567890');
    expect(adminWhatsappHref(s.contact)).toBe('https://wa.me/6281234567890?text=Halo+admin');
    expect(
      (
        await errorOf(
          adm('/admin/settings/contact', 'PUT', {
            adminWhatsapp: 'https://contoh.com/wa',
            adminMessage: '',
            groupWhatsapp: '',
          }),
        )
      ).status,
    ).toBe(400);
  });

  it('batas bayar pesanan mengikuti Pengaturan', async () => {
    await adm('/admin/settings/billing', 'PUT', {
      paywall: true,
      freeLevels: 2,
      orderExpiryHours: 6,
    });
    asParent();
    const o = await createOrder({ packageId: 'tunas', methodId: 'bca' });
    expect(Date.parse(o.expiresAt) - Date.parse(o.createdAt)).toBe(6 * 3_600_000);
  });
});

describe('mock admin: Premium per anak', () => {
  it('memberi Premium membuka level 3 hanya untuk anak itu, lalu bisa dicabut', async () => {
    passFirstTwoLevels();
    expect(
      (await errorOf(adm('/admin/premium', 'POST', { childId: AYU, durationDays: 0 }))).status,
    ).toBe(400);
    const grant = await adm<Grant>('/admin/premium', 'POST', {
      childId: AYU,
      durationDays: 30,
      note: 'Beasiswa',
    });
    expect(grant).toMatchObject({ live: true, note: 'Beasiswa', grantedByName: 'Admin UdaKids' });

    asAyu();
    expect((await startRound('matematika-kelas-1:A:3')).questions).toHaveLength(10);
    asParent();
    const kids = (await plan()).children;
    expect(kids.find((c) => c.id === AYU)?.plan).toBe('premium');
    expect(kids.find((c) => c.id === 'c-bima')?.plan).toBe('free');

    asAdmin();
    const fam = await adm<Page<FamilyRow>>('/admin/directory/families?search=ayu');
    expect(fam.total).toBe(1);
    expect(fam.items[0]!.premiumChildren).toBe(1);
    expect(fam.items[0]!.children.find((c) => c.id === AYU)!.grants).toHaveLength(1);
    expect((await adm<DirectorySummary>('/admin/directory/summary')).adminGrants).toBe(1);

    await adm(`/admin/premium/${grant.id}`, 'DELETE');
    asAyu();
    expect((await errorOf(startRound('matematika-kelas-1:A:3'))).body.code).toBe(
      'PREMIUM_REQUIRED',
    );
  });

  it('perpanjangan dimulai dari akhir pemberian; Premium selamanya tidak diperpanjang', async () => {
    const a = await adm<Grant>('/admin/premium', 'POST', { childId: AYU, durationDays: 30 });
    const b = await adm<Grant>('/admin/premium', 'POST', { childId: AYU, durationDays: 30 });
    expect(Date.parse(b.endsAt!) - Date.parse(a.endsAt!)).toBe(30 * 86_400_000);
    await adm('/admin/premium', 'POST', { childId: AYU, durationDays: null });
    expect(
      (await errorOf(adm('/admin/premium', 'POST', { childId: AYU, durationDays: 30 }))).status,
    ).toBe(409);
    expect(
      (await errorOf(adm('/admin/premium', 'POST', { childId: 'c-tidak', durationDays: 30 })))
        .status,
    ).toBe(404);
  });
});

describe('mock admin: keluarga, anak, dan staf', () => {
  it('ringkasan, pencarian, dan saringan daftar', async () => {
    const db = readDb();
    const sum = await adm<DirectorySummary>('/admin/directory/summary');
    expect(sum).toMatchObject({
      families: db.parents.length,
      children: db.children.length,
      premiumChildren: 0,
    });
    expect((await adm<Page<FamilyRow>>('/admin/directory/families?search=tidak-ada')).total).toBe(
      0,
    );
    const bima = await adm<Page<ChildRow>>('/admin/directory/children?search=bima');
    expect(bima.items.map((c) => c.nickname)).toEqual(['Bima']);
    expect(bima.items[0]!.parent.name).toBe('Ridho Dwi Syahputra');
    const premium = await adm<Page<ChildRow>>('/admin/directory/children?status=premium');
    expect(premium.total).toBe(0);
  });

  it('anak atau keluarga yang dinonaktifkan tidak bisa masuk', async () => {
    await adm(`/admin/children/${AYU}`, 'PATCH', { active: false });
    expect((await errorOf(childLogin({ childId: AYU, pin: [...AYU_PIN] }))).status).toBe(403);
    await adm(`/admin/children/${AYU}`, 'PATCH', { active: true });
    expect((await childLogin({ childId: AYU, pin: [...AYU_PIN] })).child.nickname).toBe('Ayu');

    await adm('/admin/parents/p-demo', 'PATCH', { active: false });
    expect(
      (await errorOf(parentLogin({ email: 'ridhodwi330@gmail.com', password: 'rahasia123' })))
        .status,
    ).toBe(403);
    expect((await errorOf(childLogin({ childId: AYU, pin: [...AYU_PIN] }))).status).toBe(403);
    expect((await adm<DirectorySummary>('/admin/directory/summary')).familiesInactive).toBe(1);
  });

  it('admin mengatur ulang sandi gambar anak dan password orang tua', async () => {
    expect(
      (await errorOf(adm(`/admin/children/${AYU}/pin`, 'POST', { pin: ['apple'] }))).status,
    ).toBe(400);
    await adm(`/admin/children/${AYU}/pin`, 'POST', { pin: ['ball', 'cloud', 'leaf'] });
    expect((await childLogin({ childId: AYU, pin: ['ball', 'cloud', 'leaf'] })).token).toBeTruthy();

    expect(
      (await errorOf(adm('/admin/parents/p-demo/password', 'POST', { password: 'pendek' }))).status,
    ).toBe(400);
    await adm('/admin/parents/p-demo/password', 'POST', { password: 'sandibaru123' });
    expect(
      (await parentLogin({ email: 'ridhodwi330@gmail.com', password: 'sandibaru123' })).user.role,
    ).toBe('parent');
  });

  it('staf: tambah, email ganda ditolak, akun sendiri tidak bisa dinonaktifkan', async () => {
    const sari = await adm<StaffUser>('/admin/staff', 'POST', {
      name: 'Sari',
      email: 'sari@udakids.local',
      password: 'sarisari123',
    });
    expect(sari.active).toBe(true);
    expect(
      (await staffLogin({ email: 'sari@udakids.local', password: 'sarisari123' })).user.role,
    ).toBe('admin');
    expect(
      (
        await errorOf(
          adm('/admin/staff', 'POST', {
            name: 'Sari Lagi',
            email: 'sari@udakids.local',
            password: 'sarisari123',
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (await errorOf(adm('/admin/staff', 'POST', { name: 'Budi', email: 'budi', password: 'x' })))
        .status,
    ).toBe(400);
    expect((await errorOf(adm('/admin/staff/a-demo', 'PATCH', { active: false }))).status).toBe(
      409,
    );
    await adm(`/admin/staff/${sari.id}`, 'PATCH', { active: false });
    expect(
      (await errorOf(staffLogin({ email: 'sari@udakids.local', password: 'sarisari123' }))).status,
    ).toBe(403);
    expect((await adm<StaffUser[]>('/admin/staff')).map((s) => s.email)).toContain(
      'sari@udakids.local',
    );
  });
});

describe('mock admin: laporan', () => {
  it('statistik semua level dan laporan satu anak', async () => {
    const levels = await adm<LevelStat[]>('/admin/reports/levels');
    const total = BOOKS.reduce((n, b) => n + b.topics.reduce((m, t) => m + t.levels.length, 0), 0);
    expect(levels).toHaveLength(total);
    expect(levels.every((l) => l.answered === 0 && l.accuracy === null)).toBe(true);

    const rep = await adm<AdminChildReport>(`/admin/children/${AYU}/report`);
    expect(rep.child).toMatchObject({ nickname: 'Ayu', parentName: 'Ridho Dwi Syahputra' });
    expect(rep.totals.levels).toBe(total);
    expect((await errorOf(adm('/admin/children/tidak-ada/report'))).status).toBe(404);
    expect((await adm<ChildSummaryRow[]>('/admin/children')).map((c) => c.nickname)).toContain(
      'Ayu',
    );
  });
});

describe('mock admin: paket, rekening, dan transaksi', () => {
  it('paket baru tampil di halaman depan dan area orang tua; harga jual tidak di atas harga normal', async () => {
    const bad = await errorOf(adm('/admin/packages', 'POST', { ...PACKAGE, price: 60000 }));
    expect(bad.status).toBe(400);
    expect(bad.issues[0]?.path).toBe('price');

    const pkg = await adm<PackageRow>('/admin/packages', 'POST', PACKAGE);
    expect(pkg.pricing).toEqual({
      normal: 50000,
      final: 45000,
      discount: 5000,
      discountActive: true,
    });
    expect((await publicPackages()).map((p) => p.name)).toContain('Paket Sekolah');
    asParent();
    expect((await packages()).map((p) => p.name)).toContain('Paket Sekolah');

    asAdmin();
    await adm(`/admin/packages/${pkg.id}`, 'PUT', { active: false });
    expect((await publicPackages()).map((p) => p.name)).not.toContain('Paket Sekolah');
    expect((await adm<{ deleted: boolean }>(`/admin/packages/${pkg.id}`, 'DELETE')).deleted).toBe(
      true,
    );
  });

  it('paket yang sudah dipesan hanya dinonaktifkan saat dihapus', async () => {
    asParent();
    await createOrder({ packageId: 'tunas', methodId: 'bca' });
    asAdmin();
    expect(await adm('/admin/packages/tunas', 'DELETE')).toMatchObject({
      deleted: false,
      deactivated: true,
    });
    expect(readDb().packages.find((p) => p.id === 'tunas')?.active).toBe(false);
  });

  it('rekening baru tampil di pilihan bayar orang tua', async () => {
    const m = await adm<{ id: string }>('/admin/payment-methods', 'POST', {
      kind: 'ewallet',
      name: 'GoPay',
      number: '081234567890',
      holder: 'UdaKids',
      instructions: 'Kirim ke nomor ini.',
      active: true,
      sort: 9,
    });
    asParent();
    expect((await methods()).map((x) => x.name)).toContain('GoPay');
    asAdmin();
    await adm(`/admin/payment-methods/${m.id}`, 'DELETE');
    asParent();
    expect((await methods()).map((x) => x.name)).not.toContain('GoPay');
  });

  it('bukti bayar bisa dilihat admin, dan menyetujui pesanan membuat Premium keluarga aktif', async () => {
    asParent();
    const o = await createOrder({ packageId: 'tunas', methodId: 'bca' });
    await uploadProof(o.id, {
      fileName: 'bukti.png',
      mime: 'image/png',
      size: 2048,
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    asAdmin();
    expect((await adm<{ count: number }>('/admin/orders/pending-count')).count).toBe(1);
    expect((await adm<{ dataUrl: string }>(`/admin/orders/${o.id}/proof`)).dataUrl).toContain(
      'data:image/png',
    );
    const list = await adm<{ id: string; parentName: string }[]>(
      '/admin/orders?status=awaiting_review',
    );
    expect(list.map((x) => x.parentName)).toEqual(['Ridho Dwi Syahputra']);
    expect((await adm<{ status: string }>(`/admin/orders/${o.id}/approve`, 'POST')).status).toBe(
      'paid',
    );
    expect((await adm<{ count: number }>('/admin/orders/pending-count')).count).toBe(0);
    asParent();
    expect((await plan()).children.every((c) => c.plan === 'premium')).toBe(true);
  });
});

describe('mock admin: pratinjau dan asisten', () => {
  it('pratinjau menampilkan 10 soal lengkap dengan kunci dan deterministik', async () => {
    const a = await preview('matematika-kelas-1:A:1', 7);
    const b = await preview('matematika-kelas-1:A:1', 7);
    expect(a.questions).toHaveLength(10);
    expect(a).toEqual(b);
    expect(a.questions[0]).toHaveProperty('answer');
    expect(a.questions[0]).toHaveProperty('explanation');
    expect((await errorOf(preview('tidak:ada:1', 1))).status).toBe(404);
  });
});

describe('mock admin: ringkasan dan media', () => {
  it('ringkasan menghitung antrean kerja, Premium, dan kelulusan per buku', async () => {
    asParent();
    const o = await createOrder({ packageId: 'tunas', methodId: 'bca' });
    await uploadProof(o.id, {
      fileName: 'bukti.png',
      mime: 'image/png',
      size: 2048,
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    asAdmin();
    const d = await adm<AdminDashboard>('/admin/dashboard?range=30d');
    expect(d.counts).toMatchObject({ pendingOrders: 1, premiumChildren: 0, certificates: 0 });
    expect(d.books.map((b) => b.slug)).toEqual(BOOKS.map((b) => b.slug));
    expect(d.passRate).toBeNull();
    expect(d.recentOrders[0]).toMatchObject({
      parentName: 'Ridho Dwi Syahputra',
      status: 'awaiting_review',
    });
  });

  it('ilustrasi AI masuk antrean tinjau, lalu disetujui atau ditolak', async () => {
    const bad = await errorOf(
      adm('/admin/illustrations', 'POST', { kind: 'scene', subject: 'x', theme: 'outdoor' }),
    );
    expect(bad.status).toBe(400);
    const made = await adm<Illustration>('/admin/illustrations', 'POST', {
      kind: 'scene',
      subject: 'apel merah',
      theme: 'outdoor',
      count: 5,
      withMomo: true,
      momoColor: 'blue',
      variant: 1,
    });
    expect(made).toMatchObject({ status: 'review', createdBy: 'Admin UdaKids' });
    expect(await adm<Illustration[]>('/admin/illustrations?status=approved')).toHaveLength(0);
    await adm(`/admin/illustrations/${made.id}`, 'PATCH', { status: 'approved' });
    expect(
      (await adm<Illustration[]>('/admin/illustrations?status=approved')).map((i) => i.id),
    ).toEqual([made.id]);
    expect((await adm<AdminDashboard>('/admin/dashboard')).counts.illustrationsToReview).toBe(0);
    expect(
      (await errorOf(adm(`/admin/illustrations/${made.id}`, 'PATCH', { status: 'emas' }))).status,
    ).toBe(400);
    await adm(`/admin/illustrations/${made.id}`, 'DELETE');
    expect(readDb().illustrations).toEqual([]);
  });

  it('pemakaian benda hitung dihitung dari soal generator', async () => {
    const usage = await adm<{ objects: Record<string, number> }>('/admin/media/usage');
    expect(Object.values(usage.objects).some((n) => n > 0)).toBe(true);
  });

  it('pengaturan suara narasi tersimpan dan diperiksa', async () => {
    const s = await adm<AppSettings>('/admin/settings/voice', 'PUT', {
      enabled: true,
      autoRead: false,
      rate: 1.1,
      pitch: 1,
      voiceName: '',
    });
    expect(s.voice).toMatchObject({ autoRead: false, rate: 1.1 });
    expect(
      (await errorOf(adm('/admin/settings/voice', 'PUT', { ...s.voice, rate: 3 }))).status,
    ).toBe(400);
  });
});

describe('halaman', () => {
  it('masuk staf menampilkan pesan ramah bila kata sandi keliru', async () => {
    useSession.setState({ session: null });
    render(
      <MemoryRouter initialEntries={['/masuk/staf']}>
        <Routes>
          <Route path="/masuk/staf" element={<StaffLogin />} />
          <Route path="/admin" element={<p>Ringkasan admin</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@udakids.local' } });
    fireEvent.change(screen.getByLabelText('Kata sandi'), { target: { value: 'salahsandi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('belum cocok');

    fireEvent.change(screen.getByLabelText('Kata sandi'), { target: { value: 'admin12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    await waitFor(() => expect(screen.getByText('Ringkasan admin')).toBeInTheDocument());
  });

  it('landing menampilkan 10 besar tanpa id dan tombol masuk', async () => {
    useSession.setState({ session: null });
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Rara')).toBeInTheDocument();
    const board = screen.getByRole('region', { name: '10 Besar' });
    expect(within(board).getAllByRole('listitem')).toHaveLength(10);
    for (const link of screen.getAllByRole('link', { name: 'Masuk anak' }))
      expect(link).toHaveAttribute('href', '/play/masuk');
  });

  it('harga di halaman depan mengikuti menu Paket', async () => {
    await adm('/admin/packages/tunas', 'PUT', { price: 12345 });
    useSession.setState({ session: null });
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    const pricing = screen.getByRole('region', { name: 'Harga' });
    expect(await within(pricing).findByText('Rp12.345')).toBeInTheDocument();
  });

  it('Keluarga: berikan Premium lewat dialog lalu status anak berubah', async () => {
    render(
      <MemoryRouter>
        <FamiliesPage />
      </MemoryRouter>,
    );
    const ayu = (await screen.findByText('Ayu')).closest('li')!;
    fireEvent.click(within(ayu).getByRole('button', { name: 'Atur Premium' }));
    const dialog = await screen.findByRole('dialog', { name: 'Premium untuk Ayu' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Berikan Premium' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Premium diberikan untuk Ayu.')).toBeInTheDocument();
    expect(readDb().premiumGrants).toHaveLength(1);
    expect(readDb().premiumUntil[AYU]).toBeTruthy();
  });

  it('Pengaturan: ubah level gratis lalu simpan', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    const input = await screen.findByLabelText(/Level gratis per topik/);
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(within(input.closest('form')!).getByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText('Pengaturan akses disimpan.')).toBeInTheDocument();
    expect(readDb().settings.billing.freeLevels).toBe(4);
  });

  it('Pengaturan Sistem: hanya akses berbayar, kontak WhatsApp, dan data contoh', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Akses berbayar')).toBeInTheDocument();
    expect(screen.getByText('Kontak WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Data contoh')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nama penerbit/)).toBeNull();
  });

  it('Sertifikat: Atur isi lembar membuka dialog, pratinjau mengikuti isian, Batal tidak menyimpan', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>,
    );
    const open = async () => {
      const [button] = await screen.findAllByRole('button', { name: /Atur isi lembar/ });
      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button!);
      return screen.findByRole('dialog', { name: 'Atur isi lembar sertifikat' });
    };

    let dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Nama penerbit/), {
      target: { value: 'Sekolah Ceria' },
    });
    expect(within(dialog).getByText(/SEKOLAH CERIA · BELAJAR BERSAMA MOMO/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readDb().settings.certificate.issuer).toBe('UdaKids');

    dialog = await open();
    const issuer = within(dialog).getByLabelText(/Nama penerbit/);
    expect(issuer).toHaveValue('UdaKids');
    fireEvent.change(issuer, { target: { value: 'Sekolah Ceria' } });
    fireEvent.click(within(dialog).getByLabelText(/Tampilkan kode QR/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pengaturan' }));
    expect(await screen.findByText('Pengaturan sertifikat disimpan.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readDb().settings.certificate).toMatchObject({ issuer: 'Sekolah Ceria', showQr: false });
    // Ringkasan "Lembar yang berlaku" langsung memakai isi baru.
    const facts = screen.getByText('Nama penerbit').closest('dl')!;
    expect(within(facts).getByText('Sekolah Ceria')).toBeInTheDocument();
  });

  it('Transaksi: chip saring status menampilkan jumlah per status dan menyaring daftar', async () => {
    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>,
    );
    const chips = await screen.findByRole('tablist', { name: 'Saring status pesanan' });
    const all = await within(chips).findByRole('tab', { name: 'Semua 3' });
    expect(within(chips).getByRole('tab', { name: 'Menunggu verifikasi 0' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(chips).getByRole('tab', { name: 'Ditolak 1' })).toBeInTheDocument();
    expect(screen.getByText('Tidak ada pesanan dengan status ini.')).toBeInTheDocument();
    fireEvent.click(all);
    expect(all).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findAllByRole('button', { name: /Detail pesanan/ })).toHaveLength(3);
    fireEvent.click(within(chips).getByRole('tab', { name: 'Kedaluwarsa 1' }));
    expect(screen.getAllByRole('button', { name: /Detail pesanan/ })).toHaveLength(1);
  });

  it('menu admin dikelompokkan: Konten & Kurikulum, Media & Audio, Pengguna & Akademik, Langganan', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<p>isi</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const nav = document.body;
    for (const label of [
      'Silabus Belajar',
      'Bank Soal & Latihan',
      'Sertifikat Juara',
      'Galeri Aset',
      'Audio Narasi',
      'Ilustrasi AI',
      'Keluarga & Anak',
      'Tim Staf & Akses',
      'Laporan & Rapor Belajar',
      'Transaksi & Bukti Bayar',
      'Paket Langganan',
      'Rekening & Pembayaran',
      'Pengaturan Sistem',
    ])
      expect(within(nav).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Sertifikat Juara/ })).toHaveAttribute(
      'href',
      '/admin/sertifikat',
    );
  });

  it('Ringkasan: angka utama dan catatan tindak lanjut tampil', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Anak aktif')).toBeInTheDocument();
    expect(screen.getByText('Kelulusan per buku')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada pekerjaan yang menunggu. Semua beres!')).toBeInTheDocument();
  });

  it('Bank Soal & Latihan: simulasi menjawab satu soal lalu kunci jawaban', async () => {
    render(
      <MemoryRouter>
        <SimulatorPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Mulai simulasi' }));
    const stage = screen.getByRole('region', { name: 'Layar simulasi' });
    const first = (await within(stage).findAllByRole('button')).find((b) =>
      b.classList.contains('choice'),
    );
    if (first) fireEvent.click(first);
    else {
      fireEvent.click(within(stage).getByRole('button', { name: '1' }));
      fireEvent.click(within(stage).getByRole('button', { name: 'Periksa' }));
    }
    expect(await within(stage).findByRole('status')).toHaveTextContent(/Tepat|Belum tepat/);
    fireEvent.click(screen.getByRole('button', { name: 'Kunci jawaban' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan 10 soal' }));
    expect(await within(stage).findAllByText('Jawaban:', { exact: false })).toHaveLength(10);
  });

  it('Ilustrasi AI: buat dari formulir, setujui, lalu tampil di Galeri Aset', async () => {
    const first = render(
      <MemoryRouter>
        <IllustrationsPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Buat ilustrasi/ }));
    expect(await screen.findByText(/dibuat dan menunggu ditinjau/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Setujui' }));
    expect(await screen.findByText(/disetujui dan tampil di Galeri Aset/)).toBeInTheDocument();
    expect(readDb().illustrations[0]!.status).toBe('approved');
    first.unmount();

    render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('tab', { name: /Ilustrasi AI/ }));
    expect(await screen.findByText('apel merah di kebun')).toBeInTheDocument();
  });

  it('Audio Narasi: matikan bacaan otomatis lalu simpan', async () => {
    render(
      <MemoryRouter>
        <NarrationPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByLabelText(/Bacakan halaman dan soal otomatis/));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText('Pengaturan suara disimpan.')).toBeInTheDocument();
    expect(readDb().settings.voice.autoRead).toBe(false);
  });

  it('Konten: level 3 dijadikan gratis ditandai sebagai pengecualian', async () => {
    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /Level 1–2 gratis/ })).toHaveAttribute(
      'href',
      '/admin/pengaturan',
    );
    const box = screen.getAllByRole('checkbox', { name: 'Level 3 gratis' })[0]!;
    fireEvent.click(box);
    const row = box.closest('.adm-cat-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Simpan topik' }));
    expect(await within(row).findByText('Pengecualian')).toBeInTheDocument();
    expect(readDb().contentEdits.levels['matematika-kelas-1:A:3']?.isFree).toBe(true);
  });
});
