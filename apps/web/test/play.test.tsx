import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { childLogin, familyProfiles } from '../src/api/auth';
import { ApiError } from '../src/api/client';
import { book, home, topic } from '../src/api/catalog';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';
import { ChildLogin } from '../src/play/ChildLogin';
import { installAudioUnlock } from '../src/audio/speech';
import { PlayHome } from '../src/play/PlayHome';
import { ProfilePage } from '../src/play/ProfilePage';
import { TapVoice } from '../src/play/TapVoice';
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
    expect(b.topics[0]!.code).toBe('A');
    expect(b.topics.length).toBe(10);
    expect((await errorOf(book('tidak-ada'))).status).toBe(404);
  });

  it('topik A: level 1 terbuka, level berikutnya terkunci sampai level sebelumnya lulus', async () => {
    asAyu();
    const t = await topic('matematika-kelas-1:A');
    expect(t.levels.map((l) => l.status)).toEqual(['open', 'locked', 'locked', 'locked']);
  });

  it('level 1 dan 2 gratis; setelah level 2 lulus, level 3 menjadi Premium, dan terbuka dengan langganan', async () => {
    asAyu();
    const db = readDb();
    db.passedLevels[AYU] = ['matematika-kelas-1:A:1'];
    writeDb(db);
    expect((await topic('matematika-kelas-1:A')).levels.map((l) => l.status)).toEqual([
      'passed',
      'open',
      'locked',
      'locked',
    ]);
    db.passedLevels[AYU] = ['matematika-kelas-1:A:1', 'matematika-kelas-1:A:2'];
    writeDb(db);
    expect((await topic('matematika-kelas-1:A')).levels.map((l) => l.status)).toEqual([
      'passed',
      'passed',
      'premium',
      'locked',
    ]);
    db.premiumUntil[AYU] = new Date(Date.now() + 86_400_000).toISOString();
    writeDb(db);
    expect((await topic('matematika-kelas-1:A')).levels[2]!.status).toBe('open');
  });

  it('semua topik langsung terbuka: level 1 tiap topik bisa dimainkan tanpa menyelesaikan topik lain', async () => {
    asAyu();
    for (const slug of ['matematika-kelas-1', 'matematika-kelas-3', 'sains-kelas-1']) {
      const b = await book(slug);
      expect(b.topics.length).toBe(10);
      for (const t of b.topics) {
        expect(t.levels).toHaveLength(slug === 'sains-kelas-1' && t.code === 'A' ? 3 : 4);
        expect(t.levels[0]!.status).toBe('open');
        expect(t.levels.some((l) => l.status === 'soon')).toBe(false);
      }
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
    expect(screen.getAllByText('Selesaikan level sebelumnya dulu')).toHaveLength(3);
  });

  it('beranda menampilkan Peta Belajar dengan pilihan Kelas 1 sampai 4', async () => {
    useSession.setState({ session: { token: 'mock-child:' + AYU, role: 'child', name: 'Ayu' } });
    try {
      localStorage.clear();
    } catch {
      /* abaikan */
    }
    render(
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<PlayHome />} />
        </Routes>
      </MemoryRouter>,
    );
    const chips = await screen.findByRole('navigation', { name: 'Pilih kelas' });
    for (const label of ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4'])
      expect(chips).toHaveTextContent(label);
    expect(await screen.findByText(/topik lulus/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kelas 4' }));
    expect(
      await screen.findByRole('button', { name: /Nilai tempat sampai 100.000/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mulai belajar' })).toBeInTheDocument();
  });

  it('kembali dari halaman topik membuka Peta Belajar buku topik itu, bukan daftar kartu', async () => {
    useSession.setState({ session: { token: `mock-child:${AYU}`, role: 'child', name: 'Ayu' } });
    try {
      localStorage.clear();
    } catch {
      /* abaikan */
    }
    render(
      <MemoryRouter initialEntries={['/play/topik/matematika-kelas-4:A']}>
        <Routes>
          <Route path="/play" element={<PlayHome />} />
          <Route path="/play/topik/:id" element={<TopicPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const back = await screen.findByRole('link', { name: 'Kembali' });
    expect(back).toHaveAttribute('href', '/play');
    fireEvent.click(back);
    expect(await screen.findByRole('button', { name: 'Kelas 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await screen.findByRole('button', { name: /Nilai tempat sampai 100.000/ }),
    ).toBeInTheDocument();
  });

  it('alamat lama /play/buku/:slug membuka Peta Belajar buku itu', async () => {
    useSession.setState({ session: { token: `mock-child:${AYU}`, role: 'child', name: 'Ayu' } });
    try {
      localStorage.clear();
    } catch {
      /* abaikan */
    }
    render(
      <MemoryRouter initialEntries={['/play/buku/matematika-kelas-3']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Kelas 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('profil: tanpa Hias Momo, pilihan warna tampil, dan ketukan bersuara', async () => {
    const said: string[] = [];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      onend: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: Utterance,
      configurable: true,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: { cancel: () => undefined, speak: (u: { text: string }) => said.push(u.text) },
      configurable: true,
    });
    installAudioUnlock();
    window.dispatchEvent(new Event('pointerdown'));
    useSession.setState({ session: { token: 'mock-child:' + AYU, role: 'child', name: 'Ayu' } });
    render(
      <MemoryRouter initialEntries={['/play/profil']}>
        <TapVoice />
        <Routes>
          <Route path="/play/profil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Ayu' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hias Momo' })).toBeNull();
    // Halaman langsung membacakan ringkasan profil.
    await waitFor(() => expect(said.some((x) => x.startsWith('Ayu.'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Biru' }));
    expect(said).toContain('Biru');
    fireEvent.click(screen.getByText('Total skor').closest('[role="button"]')!);
    expect(said.some((x) => /Total skor/.test(x) && x !== said[0])).toBe(true);
  });
});
