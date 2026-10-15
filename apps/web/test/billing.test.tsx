import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  account,
  changePassword,
  confirmEmailChange,
  MOCK_EMAIL_CODE,
  referral,
  requestEmailChange,
  updateName,
} from '../src/api/account';
import { insights } from '../src/api/admin';
import { parentLogin } from '../src/api/auth';
import {
  adminOrders,
  approveOrder,
  cancelOrder,
  createOrder,
  methods,
  order,
  orders,
  packages,
  pendingCount,
  rejectOrder,
  updatePackage,
  uploadProof,
} from '../src/api/billing';
import { ApiError } from '../src/api/client';
import { leaderboard } from '../src/api/leaderboard';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { plan } from '../src/api/parent';
import { startRound } from '../src/api/practice';
import { useSession } from '../src/auth/store';
import { OrderPage } from '../src/parent/OrderPage';
import { PackagesPage } from '../src/parent/PackagesPage';

const asParent = () =>
  useSession.setState({
    session: { token: 'mock-parent:p-demo', role: 'parent', name: 'Ridho Dwi Syahputra' },
  });
const asAdmin = () =>
  useSession.setState({ session: { token: 'mock-admin:a-demo', role: 'admin', name: 'Admin' } });
const asAyu = () =>
  useSession.setState({ session: { token: 'mock-child:c-ayu', role: 'child', name: 'Ayu' } });

const PROOF = {
  fileName: 'bukti.png',
  mime: 'image/png' as const,
  size: 2048,
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
};

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('seharusnya gagal');
}

beforeEach(() => {
  resetMockDb();
  asParent();
});

describe('mock billing: pesanan', () => {
  it('memuat 5 paket dan 5 cara bayar atas nama pemilik akun', async () => {
    const pk = await packages();
    expect(pk.map((p) => p.name)).toEqual([
      'Tunas',
      'Kumbang',
      'Tumbuh Bersama',
      'Bintang Kecil',
      'Teman Setia',
    ]);
    expect(pk[0]).toMatchObject({ listPrice: 50000, price: 17500, durationDays: 30 });
    expect(pk[4]?.durationDays).toBeNull();
    const me = await methods();
    expect(me.map((m) => m.name)).toEqual(['BCA', 'BNI', 'CIMB NIAGA', 'Gopay', 'ShopeePay']);
    expect(new Set(me.map((m) => m.holder))).toEqual(new Set(['Ridho Dwi Syahputra']));
  });

  it('akun demo menampilkan identitas pemilik dan tiga pesanan lama', async () => {
    const a = await account();
    expect(a).toMatchObject({
      name: 'Ridho Dwi Syahputra',
      email: 'ridhodwi330@gmail.com',
      familyCode: 'RWJUVF',
    });
    expect((await orders()).map((o) => o.status).sort()).toEqual([
      'cancelled',
      'expired',
      'rejected',
    ]);
    expect(await pendingCount()).toBe(1);
  });

  it('buat pesanan, kirim bukti, admin setujui: Premium terbuka untuk semua anak', async () => {
    const db = readDb();
    db.passedLevels['c-ayu'] = ['matematika-kelas-1:A:1'];
    writeDb(db);

    const o = await createOrder({ packageId: 'tunas', methodId: 'bca' });
    expect(o.total).toBe(o.price + o.uniqueCode);
    expect(o.uniqueCode).toBeGreaterThanOrEqual(1);
    expect(o.uniqueCode).toBeLessThanOrEqual(499);
    expect(o.status).toBe('awaiting_payment');

    const sent = await uploadProof(o.id, PROOF);
    expect(sent.status).toBe('proof_sent');

    asAyu();
    expect((await errorOf(startRound('matematika-kelas-1:A:2'))).body.code).toBe(
      'PREMIUM_REQUIRED',
    );

    asAdmin();
    expect((await adminOrders('proof_sent')).map((x) => x.id)).toContain(o.id);
    expect((await approveOrder(o.id)).status).toBe('paid');

    asAyu();
    expect((await startRound('matematika-kelas-1:A:2')).questions).toHaveLength(10);
    asParent();
    expect((await plan()).children.every((c) => c.plan === 'premium')).toBe(true);
  });

  it('admin menolak bukti: pesanan perlu bukti ulang dengan catatan', async () => {
    const o = await createOrder({ packageId: 'kumbang', methodId: 'gopay' });
    await uploadProof(o.id, PROOF);
    asAdmin();
    await rejectOrder(o.id, 'Jumlah belum sesuai');
    asParent();
    expect(await order(o.id)).toMatchObject({
      status: 'rejected',
      rejectNote: 'Jumlah belum sesuai',
    });
  });

  it('membatalkan pesanan dan membatasi 3 pesanan terbuka', async () => {
    const a = await createOrder({ packageId: 'tunas', methodId: 'bca' });
    await createOrder({ packageId: 'tunas', methodId: 'bni' });
    await createOrder({ packageId: 'tunas', methodId: 'gopay' });
    expect((await errorOf(createOrder({ packageId: 'tunas', methodId: 'bca' }))).status).toBe(409);
    expect((await cancelOrder(a.id)).status).toBe('cancelled');
    expect((await createOrder({ packageId: 'tunas', methodId: 'bca' })).status).toBe(
      'awaiting_payment',
    );
  });

  it('orang tua tidak bisa memakai rute admin; admin bisa mengubah harga paket', async () => {
    expect((await errorOf(adminOrders(null))).status).toBe(403);
    asAdmin();
    const changed = await updatePackage('tunas', { price: 20000 });
    expect(changed.price).toBe(20000);
    asParent();
    expect((await packages())[0]?.price).toBe(20000);
  });
});

describe('mock akun orang tua', () => {
  it('mengganti nama, password, dan email dengan kode konfirmasi', async () => {
    expect((await updateName('  Ridho D.  ')).name).toBe('Ridho D.');

    expect(
      (await errorOf(changePassword({ currentPassword: 'salah', newPassword: 'barubaru1' })))
        .status,
    ).toBe(401);
    await changePassword({ currentPassword: 'rahasia123', newPassword: 'barubaru1' });
    expect(
      (await parentLogin({ email: 'ridhodwi330@gmail.com', password: 'barubaru1' })).user.role,
    ).toBe('parent');

    const pending = await requestEmailChange({
      email: 'baru@contoh.id',
      currentPassword: 'barubaru1',
    });
    expect(pending.pendingEmail).toBe('baru@contoh.id');
    expect((await errorOf(confirmEmailChange('000000'))).status).toBeGreaterThanOrEqual(400);
    const done = await confirmEmailChange(MOCK_EMAIL_CODE);
    expect(done).toMatchObject({ email: 'baru@contoh.id', pendingEmail: null });
  });

  it('tautan ajakan memuat kode keluarga', async () => {
    expect((await referral()).code).toBe('RWJUVF');
  });
});

describe('mock insights dan peringkat', () => {
  it('insights admin memuat deret hari sesuai rentang', async () => {
    asAdmin();
    const week = await insights('7d');
    expect(week.days).toHaveLength(7);
    expect(week.activity).toHaveLength(7);
    expect(week.funnel.length).toBeGreaterThanOrEqual(4);
  });

  it('peringkat punya mode rata-rata, total, dan mock test kosong', async () => {
    asAyu();
    expect((await leaderboard(null, 'average')).mode).toBe('average');
    expect((await leaderboard(null, 'total')).mode).toBe('total');
    expect((await leaderboard(null, 'mock')).entries).toEqual([]);
  });
});

describe('halaman paket dan pesanan', () => {
  it('menampilkan kartu paket dengan harga coret dan label hemat', async () => {
    render(
      <MemoryRouter initialEntries={['/orang-tua/paket']}>
        <Routes>
          <Route path="/orang-tua/paket" element={<PackagesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Tunas' })).toBeInTheDocument();
    expect(screen.getByText('Hemat Rp32.500')).toBeInTheDocument();
    expect(screen.getAllByText('Semua buku, termasuk buku baru')).toHaveLength(5);
  });

  it('detail pesanan menampilkan nomor rekening dan atas nama', async () => {
    const o = await createOrder({ packageId: 'tunas', methodId: 'bca' });
    render(
      <MemoryRouter initialEntries={[`/orang-tua/transaksi/${o.id}`]}>
        <Routes>
          <Route path="/orang-tua/transaksi/:id" element={<OrderPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('5435032076')).toBeInTheDocument());
    expect(screen.getByText('Ridho Dwi Syahputra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salin jumlah' })).toBeInTheDocument();
  });
});
