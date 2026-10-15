import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  aiAssist,
  catalog,
  childReport,
  levelStats,
  overview,
  preview,
  revokePremium,
  setPremium,
  updateLevel,
  updateTopic,
  users,
} from '../src/api/admin';
import { parentLogin, staffLogin } from '../src/api/auth';
import { ApiError } from '../src/api/client';
import { topic } from '../src/api/catalog';
import { certificate } from '../src/api/certificate';
import { readDb, resetMockDb, writeDb, BOOKS, levelId } from '../src/api/mock/db';
import { plan } from '../src/api/parent';
import { startRound } from '../src/api/practice';
import { useSession } from '../src/auth/store';
import { AdminUsersPage } from '../src/admin/AdminUsersPage';
import { Landing } from '../src/site/Landing';
import { StaffLogin } from '../src/staff/StaffLogin';

const AYU = 'c-ayu';

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('seharusnya gagal');
}

const asAdmin = () =>
  useSession.setState({ session: { token: 'mock-admin:a-demo', role: 'admin', name: 'Admin' } });
const asAyu = () =>
  useSession.setState({ session: { token: `mock-child:${AYU}`, role: 'child', name: 'Ayu' } });
const asParent = () =>
  useSession.setState({
    session: { token: 'mock-parent:p-demo', role: 'parent', name: 'Ridho Dwi Syahputra' },
  });

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

  it('rute admin menolak tanpa token (401) dan peran lain (403)', async () => {
    useSession.setState({ session: null });
    expect((await errorOf(overview())).status).toBe(401);
    asParent();
    expect((await errorOf(overview())).status).toBe(403);
    asAyu();
    expect((await errorOf(users())).status).toBe(403);
  });
});

describe('mock admin: konten', () => {
  it('mengubah judul topik dan materi langsung terlihat anak', async () => {
    await updateTopic('matematika-kelas-1:A', {
      title: 'Berhitung sampai 100',
      lesson: 'Hitung benda satu per satu.',
    });
    asAyu();
    const t = await topic('matematika-kelas-1:A');
    expect(t.topic.title).toBe('Berhitung sampai 100');
    expect(t.topic.lesson).toBe('Hitung benda satu per satu.');
  });

  it('materi berkata terlarang atau kalimat terlalu panjang ditolak', async () => {
    expect(
      (await errorOf(updateTopic('matematika-kelas-1:A', { lesson: 'Jawabanmu salah.' }))).status,
    ).toBe(400);
    expect((await errorOf(updateTopic('tidak:ada', { title: 'x' }))).status).toBe(404);
  });

  it('level 2 menjadi gratis membuatnya terbuka tanpa Premium setelah level 1 lulus', async () => {
    await updateLevel('matematika-kelas-1:A:2', { isFree: true });
    const db = readDb();
    db.passedLevels[AYU] = ['matematika-kelas-1:A:1'];
    writeDb(db);
    asAyu();
    expect((await topic('matematika-kelas-1:A')).levels[1]!.status).toBe('open');
    asAdmin();
    expect((await errorOf(updateLevel('matematika-kelas-1:A:1', { isFree: false }))).status).toBe(
      400,
    );
  });

  it('suntingan bertahan setelah katalog dibaca ulang', async () => {
    await updateLevel('sains-kelas-1:A:3', { title: 'Merawat gigi' });
    const cat = await catalog();
    const level = cat.books[1]!.topics[0]!.levels[2]!;
    expect(level.title).toBe('Merawat gigi');
    expect(BOOKS[1]!.topics[0]!.levels[2]!.title).toBe('Merawat gigi');
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
  });

  it('level tanpa generator ditolak dan level tidak dikenal 404', async () => {
    expect((await errorOf(preview('matematika-kelas-1:B:1', 1))).status).toBe(409);
    expect((await errorOf(preview('tidak:ada:1', 1))).status).toBe(404);
  });

  it('asisten AI hanya mengembalikan draf teks dan mencatat permintaan', async () => {
    const res = await aiAssist('sains-kelas-1:B', 'lesson');
    expect(res.draft.length).toBeGreaterThan(20);
    expect(readDb().aiJobs).toHaveLength(1);
    expect(JSON.stringify(BOOKS)).not.toContain(res.draft);
  });
});

describe('mock admin: Premium dan laporan', () => {
  it('mengaktifkan Premium membuka level 2 dan mengubah status paket orang tua', async () => {
    const db = readDb();
    db.passedLevels[AYU] = ['matematika-kelas-1:A:1'];
    writeDb(db);

    asAyu();
    expect((await errorOf(startRound('matematika-kelas-1:A:2'))).body.code).toBe(
      'PREMIUM_REQUIRED',
    );

    asAdmin();
    expect((await errorOf(setPremium(AYU, new Date(Date.now() - 1000).toISOString()))).status).toBe(
      400,
    );
    await setPremium(AYU, new Date(Date.now() + 30 * 86_400_000).toISOString());

    asAyu();
    expect((await startRound('matematika-kelas-1:A:2')).questions).toHaveLength(10);
    asParent();
    expect((await plan()).children.find((c) => c.id === AYU)?.plan).toBe('premium');

    asAdmin();
    await revokePremium(AYU);
    asAyu();
    expect((await errorOf(startRound('matematika-kelas-1:A:2'))).body.code).toBe(
      'PREMIUM_REQUIRED',
    );
  });

  it('pencarian pengguna dan laporan anak sama dengan laporan orang tua', async () => {
    expect((await users('ayu')).parents).toHaveLength(1);
    expect((await users('tidak-ada')).total).toBe(0);
    const rep = await childReport(AYU);
    expect(rep.child.nickname).toBe('Ayu');
    expect(rep.topics.length).toBeLessThanOrEqual(8);
    expect((await levelStats()).levels).toEqual([]);
    expect((await overview()).hardestTopics).toEqual([]);
  });
});

describe('mock sertifikat', () => {
  const allLevels = () =>
    BOOKS[0]!.topics.flatMap((t) => t.levels.map((l) => levelId(BOOKS[0]!.slug, t.code, l.number)));

  it('belum selesai 404, selesai tanpa Premium 403, dengan Premium terbit', async () => {
    asAyu();
    expect((await errorOf(certificate('matematika-kelas-1'))).status).toBe(404);

    const db = readDb();
    db.passedLevels[AYU] = allLevels();
    writeDb(db);
    expect((await errorOf(certificate('matematika-kelas-1'))).body.code).toBe('PREMIUM_REQUIRED');

    db.premiumUntil[AYU] = new Date(Date.now() + 86_400_000).toISOString();
    writeDb(db);
    const cert = await certificate('matematika-kelas-1');
    expect(cert).toMatchObject({ childName: 'Ayu', bookTitle: 'Matematika Kelas 1' });
    expect((await errorOf(certificate('buku-lain'))).status).toBe(404);
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

  it('dialog Premium: aktifkan lalu status berubah', async () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    const row = (await screen.findByText('Ayu')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Atur Premium' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aktifkan' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(row).queryByText(/Premium sampai/)).toBeInTheDocument());
    expect(readDb().premiumUntil[AYU]).toBeTruthy();
  });
});
