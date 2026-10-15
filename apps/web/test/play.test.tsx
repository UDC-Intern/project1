import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { childLogin, familyProfiles } from '../src/api/auth';
import { ApiError } from '../src/api/client';
import { book, home, topic } from '../src/api/catalog';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';
import { ChildLogin } from '../src/play/ChildLogin';
import { TopicPage } from '../src/play/TopicPage';

const AYU = 'c-ayu';

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
  useSession.setState({ session: null });
});

describe('mock auth anak', () => {
  it('mengenali kode keluarga tanpa membedakan huruf besar', async () => {
    const res = await familyProfiles('rwjuvf');
    expect(res.profiles.map((p) => p.nickname)).toEqual(['Ayu', 'Bima']);
    expect((await errorOf(familyProfiles('ZZZZZZ'))).body.code).toBe('NOT_FOUND');
  });

  it('sandi benar memberi token, sandi keliru memberi sisa percobaan', async () => {
    const wrong = await errorOf(childLogin({ childId: AYU, pin: ['cat', 'cat', 'cat'] }));
    expect(wrong.body.code).toBe('WRONG_PIN');
    expect(wrong.body.attemptsLeft).toBe(4);
    const ok = await childLogin({ childId: AYU, pin: ['apple', 'star', 'fish'] });
    expect(ok.token).toContain(AYU);
  });

  it('5 sandi keliru mengunci 1 menit, kunci berikutnya 5 menit', async () => {
    const bad = { childId: AYU, pin: ['cat', 'cat', 'cat'] as ['cat', 'cat', 'cat'] };
    for (let i = 0; i < 4; i++) await errorOf(childLogin(bad));
    const locked = await errorOf(childLogin(bad));
    expect(locked.status).toBe(423);
    const first = Date.parse(locked.body.lockedUntil!) - Date.now();
    expect(first).toBeGreaterThan(55_000);
    expect(first).toBeLessThanOrEqual(60_000);

    // Sandi benar pun ditolak selama terkunci.
    const during = await errorOf(childLogin({ childId: AYU, pin: ['apple', 'star', 'fish'] }));
    expect(during.body.code).toBe('TEMPORARILY_LOCKED');

    // Kunci habis, 5 kali keliru lagi: kunci naik ke 5 menit.
    const db = readDb();
    db.children.find((c) => c.id === AYU)!.lockedUntil = Date.now() - 1;
    writeDb(db);
    for (let i = 0; i < 4; i++) await errorOf(childLogin(bad));
    const second = await errorOf(childLogin(bad));
    const ms = Date.parse(second.body.lockedUntil!) - Date.now();
    expect(ms).toBeGreaterThan(290_000);
  });

  it('anak tanpa sandi ditolak', async () => {
    const db = readDb();
    db.children.find((c) => c.id === AYU)!.pin = null;
    writeDb(db);
    expect(
      (await errorOf(childLogin({ childId: AYU, pin: ['apple', 'star', 'fish'] }))).status,
    ).toBe(403);
  });
});

describe('mock katalog', () => {
  const asAyu = () =>
    useSession.setState({ session: { token: `mock-child:${AYU}`, role: 'child', name: 'Ayu' } });

  it('butuh token anak', async () => {
    expect((await errorOf(home())).status).toBe(401);
  });

  it('beranda memuat semua buku dan buku memuat topiknya', async () => {
    asAyu();
    const h = await home();
    expect(h.books.map((b) => b.slug)).toEqual([
      'matematika-kelas-1',
      'sains-kelas-1',
      'matematika-kelas-2',
      'matematika-kelas-3',
      'matematika-kelas-4',
    ]);
    expect(h.continue).toBeNull();
    const b = await book('matematika-kelas-1');
    expect(b.topics.slice(0, 4).map((t) => t.code)).toEqual(['A', 'B', 'C', 'D']);
    expect(b.topics.length).toBeGreaterThan(30);
    expect((await errorOf(book('tidak-ada'))).status).toBe(404);
  });

  it('topik A: level 1 terbuka, level 2 dan 3 terkunci sampai level sebelumnya lulus', async () => {
    asAyu();
    const t = await topic('matematika-kelas-1:A');
    expect(t.levels.map((l) => l.status)).toEqual(['open', 'locked', 'locked']);
  });

  it('setelah level 1 lulus, level 2 menjadi Premium tanpa langganan, dan terbuka dengan langganan', async () => {
    asAyu();
    const db = readDb();
    db.passedLevels[AYU] = ['matematika-kelas-1:A:1'];
    writeDb(db);
    expect((await topic('matematika-kelas-1:A')).levels.map((l) => l.status)).toEqual([
      'passed',
      'premium',
      'locked',
    ]);
    db.premiumUntil[AYU] = new Date(Date.now() + 86_400_000).toISOString();
    writeDb(db);
    expect((await topic('matematika-kelas-1:A')).levels[1]!.status).toBe('open');
  });

  it('topik B sampai D tampil segera hadir', async () => {
    asAyu();
    for (const id of ['matematika-kelas-1:B', 'matematika-kelas-1:D', 'sains-kelas-1:C']) {
      expect((await topic(id)).levels.every((l) => l.status === 'soon')).toBe(true);
    }
  });
});

describe('halaman anak', () => {
  it('masuk lewat kode, profil, dan 3 gambar', async () => {
    render(
      <MemoryRouter initialEntries={['/play/masuk']}>
        <Routes>
          <Route path="/play/masuk" element={<ChildLogin />} />
          <Route path="/play" element={<p>Beranda anak</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Kode keluarga'), { target: { value: 'rwjuvf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ayu/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bintang' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ikan' }));
    await waitFor(() => expect(screen.getByText('Beranda anak')).toBeInTheDocument());
    expect(useSession.getState().session?.role).toBe('child');
  });

  it('sandi keliru menampilkan pesan ramah tanpa kata salah', async () => {
    render(
      <MemoryRouter initialEntries={['/play/masuk']}>
        <Routes>
          <Route path="/play/masuk" element={<ChildLogin />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Kode keluarga'), { target: { value: 'RWJUVF' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ayu/ }));
    for (const name of ['Kucing', 'Rumah', 'Awan'])
      fireEvent.click(screen.getByRole('button', { name: name }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('belum pas');
    expect(alert.textContent?.toLowerCase()).not.toContain('salah');
  });

  it('halaman topik menampilkan materi, tombol dengar, dan status level', async () => {
    useSession.setState({ session: { token: `mock-child:${AYU}`, role: 'child', name: 'Ayu' } });
    render(
      <MemoryRouter initialEntries={['/play/topik/matematika-kelas-1:A']}>
        <Routes>
          <Route path="/play/topik/:id" element={<TopicPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Bilangan sampai 100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dengarkan soal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mulai level 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Level 1: Membilang/ })).toBeInTheDocument();
    expect(screen.getAllByText('Selesaikan level sebelumnya dulu')).toHaveLength(2);
  });
});
