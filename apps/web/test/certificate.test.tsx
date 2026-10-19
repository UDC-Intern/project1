import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  CERTIFICATE_NUMBER,
  DEFAULT_SETTINGS,
  generateRound,
  seedFrom,
  type Certificate,
  type CertificateSettings,
} from '@udakids/engine';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  certificates as adminCertificates,
  deleteCertificate,
  issueCertificate,
  refreshCertificate,
  setCertificateDesign,
} from '../src/api/admin';
import { parentRegister } from '../src/api/auth';
import {
  claimCertificate,
  myCertificate,
  myCertificates,
  verifyCertificate,
} from '../src/api/certificate';
import { ApiError } from '../src/api/client';
import { BOOKS, levelId, readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { demoFinishBook } from '../src/api/mock/demo';
import { handle as adminHandle } from '../src/api/mock/adminRoutes';
import { handle } from '../src/api/mock/parentRoutes';
import { deleteChild } from '../src/api/parent';
import { answer, finish, startRound } from '../src/api/practice';
import { useSession } from '../src/auth/store';
import {
  qrPath,
  sheetDataOf,
  sheetShapes,
  type SheetData,
} from '../src/components/certificate/sheet';
import { CertificatesPage as AdminCertificatesPage } from '../src/admin/content/CertificatesPage';
import { CertificatesPage, CertificateView } from '../src/parent/Certificates';
import { ChildForm } from '../src/parent/ChildForm';
import { CertificatePage } from '../src/play/CertificatePage';
import { PlayHome } from '../src/play/PlayHome';
import { ProfilePage } from '../src/play/ProfilePage';
import { ResultPage } from '../src/play/ResultPage';
import { VerifyCertificate } from '../src/site/VerifyCertificate';

const AYU = 'c-ayu';
const BIMA = 'c-bima';
const MATH1 = 'matematika-kelas-1';
const PARENT_TOKEN = 'mock-parent:p-demo';
const ADMIN_TOKEN = 'mock-admin:a-demo';
const DAY_MS = 86_400_000;

const asChild = (id: string, name: string) =>
  useSession.setState({ session: { token: `mock-child:${id}`, role: 'child', name } });
const asParent = () =>
  useSession.setState({
    session: { token: PARENT_TOKEN, role: 'parent', name: 'Ridho Dwi Syahputra' },
  });
const asAdmin = () =>
  useSession.setState({ session: { token: 'mock-admin:a-demo', role: 'admin', name: 'Admin' } });

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('seharusnya gagal');
}

const bookLevels = (slug = MATH1) => {
  const book = BOOKS.find((b) => b.slug === slug)!;
  return book.topics.flatMap((t) => t.levels.map((l) => levelId(book.slug, t.code, l.number)));
};

/** Tandai level buku lulus, kecuali `except` level terakhir. */
function passBook(childId: string, except = 0, slug = MATH1) {
  const ids = bookLevels(slug);
  const db = readDb();
  db.passedLevels[childId] = ids.slice(0, ids.length - except);
  writeDb(db);
  return ids;
}

function givePremium(childId: string) {
  const db = readDb();
  db.premiumUntil[childId] = new Date(Date.now() + 30 * DAY_MS).toISOString();
  writeDb(db);
}

/** Memainkan satu level dengan semua jawaban tepat: kunci dibuat ulang dari level + seed, seperti server. */
async function playPerfect(id: string) {
  const [slug, code, n] = id.split(':');
  const level = BOOKS.find((b) => b.slug === slug)!
    .topics.find((t) => t.code === code)!
    .levels.find((l) => String(l.number) === n)!;
  const round = await startRound(id);
  const key = generateRound(
    {
      generator: level.generator!,
      generatorParams: level.generatorParams as Record<string, unknown> | undefined,
    },
    seedFrom(round.roundId),
  );
  for (let i = 0; i < round.questions.length; i++)
    await answer(round.roundId, { questionIndex: i, answer: key[i]!.answer });
  return finish(round.roundId);
}

beforeEach(() => {
  resetMockDb();
  try {
    localStorage.removeItem('udakids.library.book');
    localStorage.removeItem('udakids.library.grade');
  } catch {
    /* abaikan */
  }
  asChild(AYU, 'Ayu');
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.classList.remove('cert-printing');
});

describe('mock sertifikat: anak', () => {
  it('belum tuntas: kemajuan dihitung per buku dan sertifikat belum bisa diambil', async () => {
    const ids = passBook(AYU, 5);
    const book = await myCertificate(MATH1);
    expect(book).toMatchObject({
      status: 'not_finished',
      levelsPassed: ids.length - 5,
      levelsTotal: ids.length,
      topicsTotal: 10,
      certificate: null,
    });
    expect((await myCertificates()).books.map((b) => b.bookSlug)).toEqual(BOOKS.map((b) => b.slug));
    expect((await errorOf(claimCertificate(MATH1))).status).toBe(409);
    expect((await errorOf(myCertificate('buku-lain'))).status).toBe(404);
  });

  it('tuntas tanpa Premium: perlu Premium, mengambil ditolak 403', async () => {
    passBook(AYU);
    expect((await myCertificate(MATH1)).status).toBe('premium_required');
    expect((await errorOf(claimCertificate(MATH1))).body.code).toBe('PREMIUM_REQUIRED');
  });

  it('tuntas dengan Premium: sertifikat bernomor diambil sekali saja', async () => {
    passBook(AYU);
    givePremium(AYU);
    expect((await myCertificate(MATH1)).status).toBe('ready');

    const book = await claimCertificate(MATH1);
    expect(book.status).toBe('issued');
    expect(book.certificate).toMatchObject({
      childName: 'Ayu',
      bookTitle: 'Matematika Kelas 1',
      levels: bookLevels().length,
      topics: 10,
      design: 'klasik',
      source: 'claim',
    });
    expect(book.certificate!.id).toMatch(CERTIFICATE_NUMBER);
    expect((await claimCertificate(MATH1)).certificate!.id).toBe(book.certificate!.id);
    expect(Object.keys(readDb().certificates)).toHaveLength(1);
  });

  it('level terakhir lulus dengan Premium: sertifikat terbit otomatis di hasil ronde', async () => {
    const ids = passBook(AYU, 1);
    givePremium(AYU);
    const res = await playPerfect(ids.at(-1)!);
    expect(res.passed).toBe(true);
    expect(res.certificate).toMatchObject({ bookSlug: MATH1, bookTitle: 'Matematika Kelas 1' });
    expect(res.certificate!.id).toMatch(CERTIFICATE_NUMBER);
    expect((await myCertificate(MATH1)).certificate).toMatchObject({ source: 'auto' });
  });

  it('ronde biasa tidak menerbitkan sertifikat', async () => {
    const res = await playPerfect(bookLevels()[0]!);
    expect(res.passed).toBe(true);
    expect(res.certificate).toBeNull();
    expect(readDb().certificates).toEqual({});
  });

  it('menghapus profil anak ikut menghapus sertifikatnya', async () => {
    passBook(AYU);
    givePremium(AYU);
    await claimCertificate(MATH1);
    asParent();
    await deleteChild(AYU);
    expect(readDb().certificates).toEqual({});
  });
});

describe('mock sertifikat: orang tua', () => {
  it('daftar per anak sendiri; detail sertifikat keluarga lain dijawab 404', async () => {
    passBook(AYU);
    givePremium(AYU);
    const cert = (await claimCertificate(MATH1)).certificate!;

    const list = await handle<{
      children: { id: string; books: { bookSlug: string; status: string }[] }[];
    }>('/parent/certificates', 'GET', undefined, PARENT_TOKEN);
    expect(list.children.map((c) => c.id)).toEqual([AYU, BIMA]);
    expect(list.children[0]!.books.find((b) => b.bookSlug === MATH1)!.status).toBe('issued');
    expect(
      await handle<Certificate>(`/parent/certificates/${cert.id}`, 'GET', undefined, PARENT_TOKEN),
    ).toMatchObject({ id: cert.id, childName: 'Ayu' });

    const other = await parentRegister({
      name: 'Bu Sari',
      email: 'sari@contoh.id',
      password: 'rahasia123',
      consent: true,
    });
    if ('verificationRequired' in other)
      throw new Error('Mock pendaftaran seharusnya langsung masuk');
    expect(
      (await errorOf(handle(`/parent/certificates/${cert.id}`, 'GET', undefined, other.token)))
        .status,
    ).toBe(404);
  });

  it('orang tua menerbitkan sertifikat yang tertunda, bukan yang belum tuntas', async () => {
    passBook(BIMA);
    givePremium(BIMA);
    const cert = await handle<Certificate>(
      '/parent/certificates',
      'POST',
      { childId: BIMA, bookSlug: MATH1 },
      PARENT_TOKEN,
    );
    expect(cert).toMatchObject({ childName: 'Bima', source: 'claim' });
    expect(
      (
        await errorOf(
          handle('/parent/certificates', 'POST', { childId: AYU, bookSlug: MATH1 }, PARENT_TOKEN),
        )
      ).status,
    ).toBe(409);

    const overview = await handle<{
      children: {
        id: string;
        insights: { books: { slug: string; certificateId: string | null }[] };
      }[];
    }>('/parent/overview', 'GET', undefined, PARENT_TOKEN);
    const bima = overview.children.find((c) => c.id === BIMA)!;
    expect(bima.insights.books.find((b) => b.slug === MATH1)!.certificateId).toBe(cert.id);
  });
});

describe('mock sertifikat: admin', () => {
  it('kandidat, terbitkan, perbarui, desain, dan hapus', async () => {
    passBook(BIMA);
    asAdmin();
    let data = await adminCertificates();
    expect(data.candidates).toEqual([
      expect.objectContaining({ childId: BIMA, bookSlug: MATH1, hasPremium: false }),
    ]);

    const cert = await issueCertificate({ childId: BIMA, bookSlug: MATH1 });
    expect(cert).toMatchObject({ source: 'admin', childName: 'Bima', design: 'klasik' });
    expect((await errorOf(issueCertificate({ childId: BIMA, bookSlug: MATH1 }))).status).toBe(409);
    expect((await errorOf(issueCertificate({ childId: AYU, bookSlug: MATH1 }))).status).toBe(409);
    data = await adminCertificates();
    expect(data.certificates).toEqual([
      expect.objectContaining({ id: cert.id, parentName: 'Ridho Dwi Syahputra' }),
    ]);
    expect(data.candidates).toEqual([]);

    expect(await setCertificateDesign('sawah')).toEqual({ design: 'sawah' });
    expect((await errorOf(setCertificateDesign('emas' as never))).status).toBe(400);
    const db = readDb();
    db.children.find((c) => c.id === BIMA)!.nickname = 'Bimo';
    writeDb(db);
    expect(await refreshCertificate(cert.id)).toMatchObject({
      id: cert.id,
      childName: 'Bimo',
      design: 'sawah',
      issuedAt: cert.issuedAt,
    });

    await deleteCertificate(cert.id);
    data = await adminCertificates();
    expect(data.certificates).toEqual([]);
    expect(data.candidates).toHaveLength(1);
    expect((await errorOf(deleteCertificate(cert.id))).status).toBe(404);
  });

  it('hanya admin', async () => {
    expect((await errorOf(adminCertificates())).status).toBe(403);
  });

  it('bantuan demo menuntaskan buku: dengan Premium terbit, tanpa Premium menunggu', async () => {
    expect(demoFinishBook(AYU, MATH1, true)).toMatchObject({ childName: 'Ayu', source: 'auto' });
    expect(demoFinishBook(BIMA, 'sains-kelas-1', false)).toBeNull();
    asAdmin();
    expect((await adminCertificates()).candidates).toEqual([
      expect.objectContaining({ childId: BIMA, bookSlug: 'sains-kelas-1' }),
    ]);
  });
});

describe('halaman sertifikat', () => {
  const renderKid = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/play/sertifikat/:bookSlug" element={<CertificatePage />} />
          <Route path="/play/hasil/:roundId" element={<ResultPage />} />
          <Route path="/play/profil" element={<ProfilePage />} />
          <Route path="/play" element={<PlayHome />} />
        </Routes>
      </MemoryRouter>,
    );

  it('anak: belum tuntas menampilkan kemajuan, tombol lanjut, dan contoh lembar', async () => {
    passBook(AYU, 38);
    renderKid(`/play/sertifikat/${MATH1}`);
    expect(await screen.findByText('2 dari 40 level lulus')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lanjut belajar/ })).toHaveAttribute('href', '/play');
    expect(
      screen.getByRole('img', {
        name: /Sertifikat Juara Digital untuk Ayu, buku Matematika Kelas 1/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ambil sertifikatku/ })).toBeNull();
  });

  it('anak: siap diambil, lalu lembar bernomor tampil dan bisa dicetak', async () => {
    passBook(AYU);
    givePremium(AYU);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderKid(`/play/sertifikat/${MATH1}`);
    fireEvent.click(await screen.findByRole('button', { name: /Ambil sertifikatku/ }));
    const sheet = await screen.findByRole('img', { name: /nomor CERT-/ });
    expect(sheet).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cetak sertifikat/ }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.body).toHaveClass('cert-printing');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body).not.toHaveClass('cert-printing');
  });

  it('anak: tuntas tanpa Premium meminta orang tua, tanpa harga', async () => {
    passBook(AYU);
    renderKid(`/play/sertifikat/${MATH1}`);
    expect(
      await screen.findByText('Minta Ayah atau Bunda membuka sertifikat ini lewat Premium, ya!'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ambil sertifikatku/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Rp\s?\d/);
  });

  it('anak: hasil ronde merayakan sertifikat baru', async () => {
    const ids = passBook(AYU, 1);
    givePremium(AYU);
    const res = await playPerfect(ids.at(-1)!);
    renderKid(`/play/hasil/${res.roundId}`);
    expect(await screen.findByText('Hore! Kamu dapat sertifikat!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lihat sertifikat' })).toHaveAttribute(
      'href',
      `/play/sertifikat/${MATH1}`,
    );
  });

  it('anak: profil memuat Sertifikatku dan beranda memuat tautan sertifikat buku', async () => {
    passBook(AYU);
    givePremium(AYU);
    await claimCertificate(MATH1);
    renderKid('/play/profil');
    expect(await screen.findByRole('heading', { name: 'Sertifikatku' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Sertifikat Matematika Kelas 1: Sudah dapat' }),
    ).toHaveAttribute('href', `/play/sertifikat/${MATH1}`);
    expect(
      screen.getByRole('link', { name: /Sertifikat Matematika Kelas 2: 0 dari \d+ level/ }),
    ).toBeInTheDocument();
  });

  it('anak: Peta Belajar menautkan sertifikat buku yang sedang dibuka', async () => {
    passBook(AYU, 38);
    renderKid('/play');
    expect(
      await screen.findByRole('link', { name: 'Sertifikat: 2 dari 40 level lulus' }),
    ).toHaveAttribute('href', `/play/sertifikat/${MATH1}`);
  });

  it('orang tua: daftar sertifikat, contoh lembar, dan terbitkan yang tertunda', async () => {
    passBook(AYU);
    givePremium(AYU);
    const ayu = (await claimCertificate(MATH1)).certificate!;
    passBook(BIMA);
    givePremium(BIMA);
    asParent();
    render(
      <MemoryRouter initialEntries={['/orang-tua/sertifikat']}>
        <Routes>
          <Route path="/orang-tua/sertifikat" element={<CertificatesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Sertifikat Anak' })).toBeInTheDocument();
    expect(screen.getAllByText(ayu.id).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bima belum punya sertifikat/)).toBeInTheDocument();
    expect(screen.getByText('Contoh sertifikat')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Terbitkan sekarang' }));
    expect(
      await screen.findByText('Sertifikat Matematika Kelas 1 untuk Bima sudah terbit.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Bima belum punya sertifikat/)).toBeNull());
  });

  it('orang tua: halaman satu sertifikat dengan unduh dan cetak', async () => {
    passBook(AYU);
    givePremium(AYU);
    const cert = (await claimCertificate(MATH1)).certificate!;
    asParent();
    render(
      <MemoryRouter initialEntries={[`/orang-tua/sertifikat/${cert.id}`]}>
        <Routes>
          <Route path="/orang-tua/sertifikat/:id" element={<CertificateView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Ayu · Matematika Kelas 1' }),
    ).toBeInTheDocument();
    expect(screen.getByText(cert.id)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unduh gambar (PNG)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cetak / simpan PDF' })).toBeInTheDocument();
    expect(screen.getByText('Diambil setelah Premium aktif')).toBeInTheDocument();
  });

  it('admin: terbitkan dari daftar Menunggu lalu hapus dengan konfirmasi', async () => {
    passBook(BIMA);
    asAdmin();
    render(
      <MemoryRouter>
        <AdminCertificatesPage />
      </MemoryRouter>,
    );
    const waiting = await screen.findByRole('region', { name: 'Menunggu diterbitkan' });
    fireEvent.click(within(waiting).getByRole('button', { name: 'Terbitkan' }));
    expect(await screen.findByText(/terbit untuk Bima\./)).toBeInTheDocument();

    const list = screen.getByRole('region', { name: 'Sertifikat terbit' });
    await waitFor(() => expect(within(list).getByText('Bima')).toBeInTheDocument());
    fireEvent.click(within(list).getByRole('button', { name: 'Hapus' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Hapus' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Ketik hapus untuk konfirmasi'), {
      target: { value: 'hapus' },
    });
    fireEvent.click(confirm);
    expect(await screen.findByText(/dihapus\./)).toBeInTheDocument();
    expect(readDb().certificates).toEqual({});
  });
});

describe('sertifikat: nama lengkap, Pengaturan, dan cek keaslian', () => {
  const patchChild = (body: Record<string, unknown>) =>
    handle<{ certificateName: string | null }>(
      `/parent/children/${AYU}`,
      'PATCH',
      body,
      PARENT_TOKEN,
    );
  const certSettings = (patch: Partial<CertificateSettings>) =>
    adminHandle(
      '/admin/settings/certificate',
      'PUT',
      { ...readDb().settings.certificate, ...patch },
      ADMIN_TOKEN,
    );
  const nameOf = (id: string) => readDb().certificates[id]!.childName;
  const sampleCert: Certificate = {
    id: 'CERT-7KQ2MX',
    childId: AYU,
    childName: 'Ayu',
    bookSlug: MATH1,
    bookTitle: 'Matematika Kelas 1',
    topics: 10,
    levels: 40,
    design: 'klasik',
    issuedAt: '2026-10-01T00:00:00.000Z',
    source: 'auto',
    averageScore: 92,
  };

  async function issuedForAyu() {
    passBook(AYU);
    givePremium(AYU);
    return (await claimCertificate(MATH1)).certificate!;
  }

  it('nama lengkap dari orang tua dipakai di sertifikat, persetujuan wajib saat pertama diisi', async () => {
    const cert = await issuedForAyu();
    expect(cert.childName).toBe('Ayu');

    const noConsent = await errorOf(patchChild({ certificateName: 'Ayu Lestari' }));
    expect(noConsent.status).toBe(400);
    expect(noConsent.issues[0]?.path).toBe('certificateConsent');
    const badName = await errorOf(
      patchChild({ certificateName: 'Ayu123', certificateConsent: true }),
    );
    expect(badName.issues[0]?.path).toBe('certificateName');

    const saved = await patchChild({
      certificateName: '  Ayu   Lestari ',
      certificateConsent: true,
    });
    expect(saved.certificateName).toBe('Ayu Lestari');
    expect(nameOf(cert.id)).toBe('Ayu Lestari');
    const child = readDb().children.find((c) => c.id === AYU)!;
    expect(child.nickname).toBe('Ayu');
    expect(child.certificateConsentAt).toBeTruthy();

    // Mengganti nama berikutnya tidak perlu centang lagi; mengosongkan kembali ke nama panggilan.
    await patchChild({ certificateName: 'Ayu L. Putri' });
    expect(nameOf(cert.id)).toBe('Ayu L. Putri');
    await patchChild({ certificateName: '' });
    expect(nameOf(cert.id)).toBe('Ayu');
    expect(readDb().children.find((c) => c.id === AYU)!.certificateConsentAt).toBeNull();
  });

  it('Pengaturan "pakai nama lengkap" mati: semua sertifikat memakai nama panggilan', async () => {
    const cert = await issuedForAyu();
    await patchChild({ certificateName: 'Ayu Lestari', certificateConsent: true });
    await certSettings({ useFullName: false });
    expect(nameOf(cert.id)).toBe('Ayu');
    await certSettings({ useFullName: true });
    expect(nameOf(cert.id)).toBe('Ayu Lestari');
  });

  it('nama panggilan berganti: sertifikat tanpa nama lengkap ikut berganti', async () => {
    const cert = await issuedForAyu();
    await patchChild({ nickname: 'Ayuni' });
    expect(nameOf(cert.id)).toBe('Ayuni');
  });

  it('rata-rata skor terbaik level buku tercatat saat terbit', async () => {
    const ids = passBook(AYU);
    givePremium(AYU);
    const db = readDb();
    db.best[AYU] = Object.fromEntries(
      ids.map((id, i) => [id, { score: i === 0 ? 70 : 100, ms: 1 }]),
    );
    writeDb(db);
    const cert = (await claimCertificate(MATH1)).certificate!;
    expect(cert.averageScore).toBe(Math.round((70 + 100 * (ids.length - 1)) / ids.length));
  });

  it('cek keaslian: nomor terdaftar dengan nama disamarkan, nomor lain 404', async () => {
    const cert = await issuedForAyu();
    await patchChild({ certificateName: 'Ayu Lestari', certificateConsent: true });
    useSession.setState({ session: null });
    const found = await verifyCertificate(cert.id.toLowerCase());
    expect(found).toMatchObject({
      id: cert.id,
      name: 'A** L******',
      bookTitle: 'Matematika Kelas 1',
      levels: bookLevels().length,
      issuer: 'UdaKids',
    });
    expect(JSON.stringify(found)).not.toContain('Lestari');
    expect((await errorOf(verifyCertificate('CERT-ZZZZZZ'))).status).toBe(404);
  });

  it('lembar memakai teks Pengaturan: penerbit, judul, penanda tangan, kurikulum, skor, dan QR', () => {
    const settings: CertificateSettings = {
      ...DEFAULT_SETTINGS.certificate,
      issuer: 'Sekolah Ceria',
      title: 'PIAGAM',
      subtitle: '',
      signer2Name: 'Bu Rina',
      signer2Role: 'Kepala Sekolah',
      curriculum: 'Sesuai Kurikulum Merdeka',
    };
    const data: SheetData = {
      childName: 'Ayu Lestari',
      bookTitle: 'Matematika Kelas 1',
      levels: 40,
      topics: 10,
      design: 'klasik',
      number: 'CERT-7KQ2MX',
      issuedAt: '2026-10-01T00:00:00.000Z',
      averageScore: 92,
      settings,
      verifyUrl: 'https://contoh.id/sertifikat/cek/CERT-7KQ2MX',
    };
    const texts = (d: SheetData) =>
      sheetShapes(d).flatMap((s) => (s.kind === 'text' ? [s.text] : []));
    const full = texts(data);
    expect(full).toEqual(
      expect.arrayContaining([
        'SEKOLAH CERIA · BELAJAR BERSAMA MOMO',
        'PIAGAM',
        'Ayu Lestari',
        'Bu Rina',
        'Kepala Sekolah',
        'Sesuai Kurikulum Merdeka · Rata-rata skor 92',
        'Pindai untuk cek',
      ]),
    );
    expect(full).not.toContain('JUARA DIGITAL');

    const plain = texts({ ...data, settings: { ...settings, showScore: false }, verifyUrl: null });
    expect(plain).toContain('Sesuai Kurikulum Merdeka');
    expect(plain).not.toContain('Pindai untuk cek');
    // Contoh lembar (belum terbit) tidak pernah memuat QR.
    expect(texts({ ...data, number: null, issuedAt: null })).not.toContain('Pindai untuk cek');

    expect(sheetDataOf({ ...sampleCert, id: 'CERT-7KQ2MX' }, settings).verifyUrl).toMatch(
      /\/sertifikat\/cek\/CERT-7KQ2MX$/,
    );
    expect(sheetDataOf(sampleCert, { ...settings, showQr: false }).verifyUrl).toBeNull();
    expect(qrPath('https://contoh.id/sertifikat/cek/CERT-7KQ2MX', 0, 0, 76)).toMatch(
      /^M[\d.]+ [\d.]+h/,
    );
  });

  it('halaman cek keaslian publik: cocok dan tidak cocok', async () => {
    const cert = await issuedForAyu();
    useSession.setState({ session: null });
    const view = (path: string) =>
      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/sertifikat/cek" element={<VerifyCertificate />} />
            <Route path="/sertifikat/cek/:id" element={<VerifyCertificate />} />
          </Routes>
        </MemoryRouter>,
      );
    const first = view(`/sertifikat/cek/${cert.id}`);
    expect(
      await screen.findByText('Sertifikat asli, diterbitkan oleh UdaKids'),
    ).toBeInTheDocument();
    expect(screen.getByText('A**')).toBeInTheDocument();
    first.unmount();

    view('/sertifikat/cek');
    fireEvent.change(screen.getByLabelText('Nomor sertifikat'), {
      target: { value: 'cert-zzzzzz' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cek' }));
    expect(await screen.findByText('Nomor CERT-ZZZZZZ tidak terdaftar.')).toBeInTheDocument();
  });

  it('orang tua: isi nama lengkap di halaman Sertifikat dengan centang persetujuan', async () => {
    const cert = await issuedForAyu();
    asParent();
    render(
      <MemoryRouter initialEntries={['/orang-tua/sertifikat']}>
        <Routes>
          <Route path="/orang-tua/sertifikat" element={<CertificatesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const field = (
      await screen.findAllByRole('textbox', { name: 'Nama lengkap untuk sertifikat' })
    )[0]!;
    const form = field.closest('form')!;
    fireEvent.change(field, { target: { value: 'Ayu Lestari' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Simpan nama' }));
    expect(
      await within(form).findByText('Centang persetujuan dulu untuk menyimpan nama lengkap.'),
    ).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('checkbox', { name: /setuju nama lengkap/ }));
    fireEvent.click(within(form).getByRole('button', { name: 'Simpan nama' }));
    expect(await screen.findByText(/Nama di sertifikat Ayu Lestari disimpan/)).toBeInTheDocument();
    expect(await screen.findByText(/Nama di sertifikat: Ayu Lestari/)).toBeInTheDocument();
    expect(nameOf(cert.id)).toBe('Ayu Lestari');
  });

  it('orang tua: formulir ubah anak memuat nama sertifikat; disembunyikan bila Pengaturan mematikannya', async () => {
    asParent();
    const edit = () =>
      render(
        <MemoryRouter initialEntries={[`/orang-tua/anak/${AYU}/ubah`]}>
          <Routes>
            <Route path="/orang-tua/anak/:id/ubah" element={<ChildForm mode="edit" />} />
            <Route path="/orang-tua" element={<p>Beranda orang tua</p>} />
          </Routes>
        </MemoryRouter>,
      );
    const first = edit();
    fireEvent.change(await screen.findByLabelText(/Nama lengkap untuk sertifikat/), {
      target: { value: 'Ayu Lestari' },
    });
    expect(screen.getByText('Di sertifikat: Ayu Lestari')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /setuju nama lengkap/ }));
    fireEvent.click(screen.getByRole('button', { name: /Simpan/ }));
    expect(await screen.findByText('Beranda orang tua')).toBeInTheDocument();
    expect(readDb().children.find((c) => c.id === AYU)!.certificateName).toBe('Ayu Lestari');
    first.unmount();

    await certSettings({ useFullName: false });
    edit();
    expect(await screen.findByLabelText(/Nama panggilan/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nama lengkap untuk sertifikat/)).toBeNull();
  });
});
