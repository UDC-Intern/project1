import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { generateRound, seedFrom, type Pin } from '@udakids/engine';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { childLogin, familyProfiles, parentLogin, parentRegister } from '../src/api/auth';
import { ApiError } from '../src/api/client';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import {
  createChild,
  deleteChild,
  overview,
  plan,
  report,
  setPin,
  updateChild,
} from '../src/api/parent';
import { answer, finish, startRound } from '../src/api/practice';
import { useSession } from '../src/auth/store';
import { ChildForm } from '../src/parent/ChildForm';
import { Dashboard } from '../src/parent/Dashboard';
import { ParentRegister } from '../src/parent/ParentRegister';

const PIN: Pin = ['cat', 'house', 'leaf'];

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('seharusnya gagal');
}

async function registerAs(email: string, name = 'Bu Sari') {
  const res = await parentRegister({ name, email, password: 'rahasia123', consent: true });
  useSession.setState({ session: { token: res.token, role: 'parent', name } });
  return res;
}

beforeEach(() => {
  resetMockDb();
  useSession.setState({ session: null });
});

describe('mock akun orang tua', () => {
  it('daftar memberi kode keluarga 6 huruf tanpa I dan O', async () => {
    const res = await registerAs('sari@contoh.id');
    expect(res.user.familyCode).toMatch(/^[A-HJ-NP-Z]{6}$/);
    expect(res.user.role).toBe('parent');
  });

  it('daftar tanpa persetujuan, kata sandi pendek, atau email kembar ditolak', async () => {
    const base = { name: 'Bu Sari', email: 'sari@contoh.id', password: 'rahasia123' };
    expect(
      (await errorOf(parentRegister({ ...base, consent: false as unknown as true }))).status,
    ).toBe(400);
    expect(
      (await errorOf(parentRegister({ ...base, password: 'pendek', consent: true }))).status,
    ).toBe(400);
    await parentRegister({ ...base, consent: true });
    expect((await errorOf(parentRegister({ ...base, consent: true }))).status).toBe(409);
  });

  it('masuk dengan kata sandi benar, ditolak bila keliru', async () => {
    await registerAs('sari@contoh.id');
    expect((await parentLogin({ email: 'sari@contoh.id', password: 'rahasia123' })).user.name).toBe(
      'Bu Sari',
    );
    expect(
      (await errorOf(parentLogin({ email: 'sari@contoh.id', password: 'rahasia000' }))).body.code,
    ).toBe('INVALID_CREDENTIALS');
  });
});

describe('mock anak dan laporan', () => {
  it('alur penuh: tambah Citra, atur sandi, masuk, main, laporan berubah', async () => {
    const parent = await registerAs('sari@contoh.id');
    const citra = await createChild({ nickname: 'Citra', momoColor: 'teal' });
    expect(citra.hasPin).toBe(false);

    // Tanpa sandi, anak belum bisa masuk.
    const before = await familyProfiles(parent.user.familyCode!);
    expect(before.profiles[0]).toMatchObject({ nickname: 'Citra', hasPin: false });
    expect((await errorOf(childLogin({ childId: citra.id, pin: PIN }))).status).toBe(403);

    await setPin(citra.id, PIN);
    const login = await childLogin({ childId: citra.id, pin: PIN });
    useSession.setState({ session: { token: login.token, role: 'child', name: 'Citra' } });

    const round = await startRound('matematika-kelas-1:A:1');
    const key = generateRound(
      { generator: 'count', generatorParams: { max: 20 } },
      seedFrom(round.roundId),
    );
    for (let i = 0; i < 10; i++)
      await answer(round.roundId, { questionIndex: i, answer: key[i]!.answer });
    await finish(round.roundId);

    useSession.setState({ session: { token: parent.token, role: 'parent', name: 'Bu Sari' } });
    const home = await overview();
    expect(home.week).toMatchObject({ rounds: 1, levelsPassed: 1, activeChildren: 1 });
    expect(home.children[0]).toMatchObject({ rounds: 1, levelsPassed: 1, totalScore: 100 });

    const rep = await report(citra.id);
    expect(rep.weekAccuracy).toBe(100);
    expect(rep.recentRounds).toHaveLength(1);
    const topic = rep.topics.find((t) => t.topicId === 'matematika-kelas-1:A')!;
    expect(topic.mastery).toBeGreaterThan(0);
    expect(rep.suggestions[0]?.topicId).toBe('matematika-kelas-1:A');
  });

  it('maksimal 3 anak dan nama kembar ditolak', async () => {
    await registerAs('sari@contoh.id');
    await createChild({ nickname: 'Ayu', momoColor: 'blue' });
    expect((await errorOf(createChild({ nickname: 'ayu', momoColor: 'pink' }))).status).toBe(409);
    await createChild({ nickname: 'Bima', momoColor: 'green' });
    await createChild({ nickname: 'Citra', momoColor: 'teal' });
    expect((await errorOf(createChild({ nickname: 'Dewi', momoColor: 'pink' }))).status).toBe(409);
  });

  it('anak orang tua lain dijawab 404', async () => {
    await registerAs('sari@contoh.id');
    const mine = await createChild({ nickname: 'Citra', momoColor: 'teal' });
    await registerAs('budi@contoh.id', 'Pak Budi');
    expect((await errorOf(report(mine.id))).status).toBe(404);
    expect((await errorOf(setPin(mine.id, PIN))).status).toBe(404);
    expect((await errorOf(updateChild(mine.id, { nickname: 'Lain' }))).status).toBe(404);
    expect((await errorOf(deleteChild(mine.id))).status).toBe(404);
  });

  it('sandi baru mengatur ulang kunci, menghapus anak membersihkan datanya', async () => {
    await registerAs('sari@contoh.id');
    const c = await createChild({ nickname: 'Citra', momoColor: 'teal' });
    await setPin(c.id, PIN);
    const db = readDb();
    db.children.find((x) => x.id === c.id)!.lockedUntil = Date.now() + 60_000;
    writeDb(db);
    await setPin(c.id, ['star', 'star', 'star']);
    expect(readDb().children.find((x) => x.id === c.id)!.lockedUntil).toBeNull();

    await deleteChild(c.id);
    expect((await overview()).children).toHaveLength(0);
  });

  it('paket menampilkan Free atau Premium per anak', async () => {
    await registerAs('sari@contoh.id');
    const c = await createChild({ nickname: 'Citra', momoColor: 'teal' });
    expect((await plan()).children[0]).toMatchObject({ plan: 'free', until: null });
    const db = readDb();
    db.premiumUntil[c.id] = new Date(Date.now() + 86_400_000).toISOString();
    writeDb(db);
    expect((await plan()).children[0]!.plan).toBe('premium');
  });
});

describe('halaman orang tua', () => {
  it('daftar tanpa centang persetujuan menampilkan pesan', async () => {
    render(
      <MemoryRouter initialEntries={['/orang-tua/daftar']}>
        <Routes>
          <Route path="/orang-tua/daftar" element={<ParentRegister />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Nama kamu'), { target: { value: 'Bu Sari' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sari@contoh.id' } });
    fireEvent.change(screen.getByLabelText(/Kata sandi/), { target: { value: 'rahasia123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }));
    expect(await screen.findByText('Centang persetujuan dulu, ya.')).toBeInTheDocument();
    expect(readDb().parents).toHaveLength(1);
  });

  it('dasbor menampilkan kode keluarga dan profil anak', async () => {
    const parent = await registerAs('sari@contoh.id');
    await createChild({ nickname: 'Citra', momoColor: 'teal' });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText(parent.user.familyCode!)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Citra' })).toBeInTheDocument();
    expect(screen.getByText('1 dari 3 anak terdaftar')).toBeInTheDocument();
  });

  it('atur sandi: urutan ulangan harus sama lalu disimpan', async () => {
    await registerAs('sari@contoh.id');
    const c = await createChild({ nickname: 'Citra', momoColor: 'teal' });
    render(
      <MemoryRouter initialEntries={[`/orang-tua/anak/${c.id}/sandi`]}>
        <Routes>
          <Route path="/orang-tua/anak/:id/sandi" element={<ChildForm mode="pin" />} />
          <Route path="/orang-tua" element={<p>Beranda</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const tap = async (...names: string[]) => {
      for (const n of names) fireEvent.click(await screen.findByRole('button', { name: n }));
    };
    await tap('Pilih kucing', 'Pilih rumah', 'Pilih daun');
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut ke konfirmasi' }));
    await tap('Pilih kucing', 'Pilih daun', 'Pilih rumah');
    expect(await screen.findByText(/belum sama/)).toBeInTheDocument();
    await tap('Pilih kucing', 'Pilih rumah', 'Pilih daun');
    expect(await screen.findByText(/Sandi gambar cocok/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simpan sandi gambar' }));
    await waitFor(() => expect(screen.getByText('Beranda')).toBeInTheDocument());
    expect(readDb().children.find((x) => x.id === c.id)!.pin).toEqual(PIN);
  });

  it('tambah profil anak lewat formulir lengkap', async () => {
    await registerAs('sari@contoh.id');
    render(
      <MemoryRouter initialEntries={['/orang-tua/anak/baru']}>
        <Routes>
          <Route path="/orang-tua/anak/baru" element={<ChildForm mode="new" />} />
          <Route path="/orang-tua" element={<p>Beranda</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByLabelText(/Nama panggilan/), { target: { value: 'Dodi' } });
    for (const n of ['Pilih apel', 'Pilih bola', 'Pilih bintang'])
      fireEvent.click(screen.getByRole('button', { name: n }));
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut ke konfirmasi' }));
    for (const n of ['Pilih apel', 'Pilih bola', 'Pilih bintang'])
      fireEvent.click(screen.getByRole('button', { name: n }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan profil' }));
    await waitFor(() => expect(screen.getByText('Beranda')).toBeInTheDocument());
    const made = readDb().children.find((x) => x.nickname === 'Dodi')!;
    expect(made.pin).toEqual(['apple', 'ball', 'star']);
  });

  it('hapus anak dari dasbor meminta konfirmasi', async () => {
    await registerAs('sari@contoh.id');
    const c = await createChild({ nickname: 'Citra', momoColor: 'teal' });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya, hapus semua data Citra' }));
    await waitFor(() => expect(readDb().children.some((x) => x.id === c.id)).toBe(false));
  });
});
