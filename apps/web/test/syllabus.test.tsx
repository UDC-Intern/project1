import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LevelQuestions } from '../src/api/mock/syllabus';
import type { CatalogBook } from '../src/api/adminTypes';
import { ApiError } from '../src/api/client';
import { home, topic as childTopic } from '../src/api/catalog';
import { handle } from '../src/api/mock/adminRoutes';
import { BOOKS, applyEdits, readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { startRound } from '../src/api/practice';
import { CatalogPage } from '../src/admin/catalog/CatalogPage';
import { useSession } from '../src/auth/store';
import * as i18n from '../src/i18n';

const ADMIN = 'mock-admin:a-demo';
const adm = <T,>(path: string, method = 'GET', body?: Record<string, unknown>) =>
  handle<T>(path, method, body, ADMIN);

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('seharusnya gagal');
}

const asAdmin = () =>
  useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
const asAyu = () =>
  useSession.setState({ session: { token: 'mock-child:c-ayu', role: 'child', name: 'Ayu' } });

const newTopic = (patch: Record<string, unknown> = {}) => ({
  title: 'Mengenal bentuk',
  lesson: 'Ada bentuk bulat dan kotak. Kita mencarinya di sekitar kita.',
  tips: ['Bola berbentuk bulat.'],
  levels: [{ title: 'Bentuk dasar' }, { title: 'Bentuk lanjut' }],
  ...patch,
});
const bank = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    prompt: `Berapa hasil ${i + 1} tambah 1?`,
    choices: [String(i + 2), String(i + 3), String(i + 1)],
    answer: 0,
    hint: `${i + 1} tambah 1 sama dengan ${i + 2}.`,
  }));
const find = (books: CatalogBook[], slug: string) => books.find((b) => b.slug === slug)!;
const catalog = () => adm<CatalogBook[]>('/admin/catalogs');

beforeEach(() => {
  resetMockDb();
  asAdmin();
});

describe('Silabus Belajar: katalog', () => {
  it('buku bawaan ditandai bukan buatan admin, dengan asal soal tiap level', async () => {
    const books = await catalog();
    expect(books.map((b) => [b.slug, b.grade, b.custom])).toEqual([
      ['matematika-kelas-1', 1, false],
      ['sains-kelas-1', 1, false],
      ['matematika-kelas-2', 2, false],
      ['matematika-kelas-3', 3, false],
      ['matematika-kelas-4', 4, false],
    ]);
    const level = books[0]!.topics[0]!.levels[0]!;
    expect(level).toMatchObject({ source: 'auto', questions: 0, custom: false, used: false });
    const sains = find(books, 'sains-kelas-1');
    const banks = sains.topics.flatMap((t) => t.levels).filter((l) => l.source === 'bank');
    expect(banks.length).toBeGreaterThan(0);
    expect(banks.every((l) => l.questions >= 4 && !l.custom)).toBe(true);
  });
});

describe('Silabus Belajar: tambah buku, topik, dan level', () => {
  it('buku baru lahir dengan topik pertama; level belum punya soal', async () => {
    const books = await adm<CatalogBook[]>('/admin/books', 'POST', {
      subject: 'math',
      grade: 5,
      title: 'Matematika Kelas 5',
      topic: newTopic(),
    });
    const made = find(books, 'matematika-kelas-5');
    expect(made).toMatchObject({
      title: 'Matematika Kelas 5',
      grade: 5,
      custom: true,
      used: false,
    });
    expect(made.topics).toHaveLength(1);
    expect(made.topics[0]).toMatchObject({
      code: 'T1',
      custom: true,
      tips: ['Bola berbentuk bulat.'],
    });
    expect(made.topics[0]!.levels.map((l) => [l.number, l.free, l.source, l.custom])).toEqual([
      [1, true, 'none', true],
      [2, true, 'none', true],
    ]);
    // Buku bawaan tetap di depan; buku baru di akhir.
    expect(books.at(-1)!.slug).toBe('matematika-kelas-5');
    expect(BOOKS.some((b) => b.slug === 'matematika-kelas-5')).toBe(true);
    // Anak ikut melihatnya: kelas baru muncul di beranda.
    asAyu();
    const shelf = (await home()).books.find((b) => b.slug === 'matematika-kelas-5');
    expect(shelf).toMatchObject({ grade: 5, topicsTotal: 1 });
  });

  it('satu buku untuk satu pasangan mapel dan kelas, dan isian yang keliru ditolak per isian', async () => {
    const body = { subject: 'math', grade: 5, title: 'Matematika Kelas 5', topic: newTopic() };
    await adm('/admin/books', 'POST', body);
    expect((await errorOf(adm('/admin/books', 'POST', body))).status).toBe(409);
    // Buku bawaan juga menempati pasangannya.
    expect(
      (await errorOf(adm('/admin/books', 'POST', { ...body, grade: 1 }))).body.message,
    ).toMatch(/sudah ada/);

    const bad = await errorOf(
      adm('/admin/books', 'POST', {
        ...body,
        subject: 'science',
        title: 'S',
        topic: newTopic({ title: 'X', levels: [] }),
      }),
    );
    expect(bad.status).toBe(400);
    expect(bad.issues.map((i) => i.path).sort()).toEqual(['title', 'topic.levels', 'topic.title']);
    expect((await errorOf(adm('/admin/books', 'POST', { ...body, extra: true }))).status).toBe(400);
  });

  it('topik baru: kode otomatis, kode sendiri unik, urut di akhir, dan bahasa untuk anak dijaga', async () => {
    const first = await adm<CatalogBook[]>(
      '/admin/books/matematika-kelas-1/topics',
      'POST',
      newTopic(),
    );
    const topics = find(first, 'matematika-kelas-1').topics;
    expect(topics).toHaveLength(11);
    expect(topics.at(-1)).toMatchObject({ code: 'T1', title: 'Mengenal bentuk', custom: true });
    expect(topics[0]!.custom).toBe(false);

    const second = await adm<CatalogBook[]>('/admin/books/matematika-kelas-1/topics', 'POST', {
      ...newTopic({ title: 'Bentuk lain' }),
      code: 'b9',
    });
    expect(find(second, 'matematika-kelas-1').topics.at(-1)!.code).toBe('B9');

    const dupe = await errorOf(
      adm('/admin/books/matematika-kelas-1/topics', 'POST', { ...newTopic(), code: 'a' }),
    );
    expect(dupe).toMatchObject({ status: 400 });
    expect(dupe.issues[0]).toMatchObject({ path: 'code' });
    const rude = await errorOf(
      adm(
        '/admin/books/matematika-kelas-1/topics',
        'POST',
        newTopic({ lesson: 'Jawaban salah diulang.' }),
      ),
    );
    expect(rude.issues[0]).toMatchObject({ path: 'lesson' });
    expect((await errorOf(adm('/admin/books/tidak-ada/topics', 'POST', newTopic()))).status).toBe(
      404,
    );
  });

  it('level baru ditambah di akhir topik, paling banyak 12', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
    const id = 'matematika-kelas-1:T1';
    let books = await adm<CatalogBook[]>(`/admin/topics/${id}/levels`, 'POST', {
      title: 'Level tiga',
    });
    let levels = find(books, 'matematika-kelas-1').topics.at(-1)!.levels;
    expect(levels.map((l) => l.number)).toEqual([1, 2, 3]);
    expect(levels[2]).toMatchObject({
      title: 'Level tiga',
      free: false,
      custom: true,
      source: 'none',
    });
    for (let n = 4; n <= 12; n++)
      books = await adm<CatalogBook[]>(`/admin/topics/${id}/levels`, 'POST', {
        title: `Level ${n}`,
      });
    levels = find(books, 'matematika-kelas-1').topics.at(-1)!.levels;
    expect(levels).toHaveLength(12);
    expect(
      (await errorOf(adm(`/admin/topics/${id}/levels`, 'POST', { title: 'Terlalu' }))).status,
    ).toBe(409);
    expect((await errorOf(adm(`/admin/topics/${id}/levels`, 'POST', { title: ' ' }))).status).toBe(
      400,
    );
  });

  it('suntingan judul dan akses berlaku juga untuk isi buatan admin, dan bertahan setelah dimuat ulang', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
    await adm('/admin/topics/matematika-kelas-1:T1', 'PATCH', { title: 'Bentuk di sekitar' });
    await adm('/admin/levels/matematika-kelas-1:T1:2', 'PATCH', { free: false });
    let t = find(await catalog(), 'matematika-kelas-1').topics.at(-1)!;
    expect(t.title).toBe('Bentuk di sekitar');
    expect(t.levels[1]).toMatchObject({ free: false, override: true });

    // Dimuat ulang dari penyimpanan: semua tersusun lagi dari data tersimpan.
    const saved = structuredClone(readDb().contentEdits);
    BOOKS.splice(0, BOOKS.length);
    applyEdits(saved);
    t = find(await catalog(), 'matematika-kelas-1').topics.at(-1)!;
    expect(t).toMatchObject({ code: 'T1', title: 'Bentuk di sekitar', custom: true });
  });
});

describe('Silabus Belajar: bank soal tulisan admin', () => {
  const level1 = 'matematika-kelas-1:T1:1';

  beforeEach(async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
  });

  it('bank kosong lebih dulu, lalu disimpan dan level langsung bisa dimainkan anak', async () => {
    const empty = await adm<LevelQuestions>(`/admin/levels/${level1}/questions`);
    expect(empty).toMatchObject({ items: [], min: 4, good: 10, max: 60 });

    const books = await adm<CatalogBook[]>(`/admin/levels/${level1}/questions`, 'PUT', {
      items: bank(6),
    });
    const lv = find(books, 'matematika-kelas-1').topics.at(-1)!.levels;
    expect(lv[0]).toMatchObject({ source: 'bank', questions: 6, generator: 'skill' });
    expect(lv[1]).toMatchObject({ source: 'none', questions: 0 });
    expect((await adm<LevelQuestions>(`/admin/levels/${level1}/questions`)).items).toEqual(bank(6));

    asAyu();
    const detail = await childTopic('matematika-kelas-1:T1');
    expect(detail.levels.map((l) => l.status)).toEqual(['open', 'soon']);
    const round = await startRound(level1);
    expect(round.questions).toHaveLength(10);
    for (const q of round.questions) {
      expect(q.options).toHaveLength(3);
      expect(JSON.stringify(q)).not.toMatch(/answer|explanation/);
    }
  });

  it('menolak bank yang kurang atau keliru, dengan isu per soal', async () => {
    const few = await errorOf(adm(`/admin/levels/${level1}/questions`, 'PUT', { items: bank(3) }));
    expect(few).toMatchObject({ status: 400 });
    expect(few.body.message).toBe('Tulis minimal 4 soal.');

    const items = bank(5);
    items[2] = { ...items[2]!, prompt: 'Mana yang salah?' };
    items[4] = { ...items[4]!, choices: ['1', '1', '2'] };
    const bad = await errorOf(adm(`/admin/levels/${level1}/questions`, 'PUT', { items }));
    expect(bad.issues.map((i) => i.path).sort()).toEqual(['2.prompt', '4.choices.1']);
    expect((await errorOf(adm(`/admin/levels/${level1}/questions`, 'PUT', {}))).status).toBe(400);
  });

  it('level yang tidak ada dijawab 404 untuk semua aksi soal', async () => {
    for (const method of ['GET', 'PUT', 'DELETE'])
      expect(
        (
          await errorOf(
            adm('/admin/levels/matematika-kelas-1:ZZ:1/questions', method, { items: bank(5) }),
          )
        ).status,
      ).toBe(404);
  });

  it('bank dikosongkan kembali menjadi "Segera hadir", kecuali sudah dikerjakan anak', async () => {
    await adm(`/admin/levels/${level1}/questions`, 'PUT', { items: bank(5) });
    const books = await adm<CatalogBook[]>(`/admin/levels/${level1}/questions`, 'DELETE');
    expect(find(books, 'matematika-kelas-1').topics.at(-1)!.levels[0]).toMatchObject({
      source: 'none',
      generator: null,
    });

    await adm(`/admin/levels/${level1}/questions`, 'PUT', { items: bank(5) });
    const db = readDb();
    db.passedLevels['c-ayu'] = [level1];
    writeDb(db);
    expect((await errorOf(adm(`/admin/levels/${level1}/questions`, 'DELETE'))).status).toBe(409);
    // Soalnya masih bisa disunting walau sudah dikerjakan.
    await adm(`/admin/levels/${level1}/questions`, 'PUT', { items: bank(7) });
  });
});

describe('Silabus Belajar: hapus', () => {
  it('buku, topik, dan level bawaan tidak bisa dihapus', async () => {
    expect((await errorOf(adm('/admin/books/matematika-kelas-1', 'DELETE'))).status).toBe(409);
    expect((await errorOf(adm('/admin/topics/matematika-kelas-1:A', 'DELETE'))).status).toBe(409);
    expect((await errorOf(adm('/admin/levels/matematika-kelas-1:A:4', 'DELETE'))).status).toBe(409);
    expect((await errorOf(adm('/admin/books/tidak-ada', 'DELETE'))).status).toBe(404);
  });

  it('topik buatan admin dihapus beserta level dan suntingannya; topik terakhir tidak bisa', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
    await adm('/admin/topics/matematika-kelas-1:T1', 'PATCH', { title: 'Judul baru' });
    const books = await adm<CatalogBook[]>('/admin/topics/matematika-kelas-1:T1', 'DELETE');
    expect(find(books, 'matematika-kelas-1').topics).toHaveLength(10);
    expect(readDb().contentEdits.topics['matematika-kelas-1:T1']).toBeUndefined();
    expect(readDb().contentEdits.added?.topics).toEqual([]);

    await adm('/admin/books', 'POST', {
      subject: 'science',
      grade: 3,
      title: 'Sains Kelas 3',
      topic: newTopic(),
    });
    expect((await errorOf(adm('/admin/topics/sains-kelas-3:T1', 'DELETE'))).body.message).toMatch(
      /terakhir/,
    );
  });

  it('level hanya dihapus dari yang terakhir, dan bukan satu-satunya', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
    const first = await errorOf(adm('/admin/levels/matematika-kelas-1:T1:1', 'DELETE'));
    expect(first.body.message).toMatch(/paling akhir/);
    const books = await adm<CatalogBook[]>('/admin/levels/matematika-kelas-1:T1:2', 'DELETE');
    expect(find(books, 'matematika-kelas-1').topics.at(-1)!.levels).toHaveLength(1);
    const sole = await errorOf(adm('/admin/levels/matematika-kelas-1:T1:1', 'DELETE'));
    expect(sole.body.message).toMatch(/terakhir/);
  });

  it('yang sudah dikerjakan anak tidak bisa dihapus', async () => {
    await adm('/admin/books', 'POST', {
      subject: 'math',
      grade: 6,
      title: 'Matematika Kelas 6',
      topic: newTopic(),
    });
    await adm('/admin/books/matematika-kelas-6/topics', 'POST', newTopic({ title: 'Topik kedua' }));
    const db = readDb();
    db.passedLevels['c-ayu'] = ['matematika-kelas-6:T1:1'];
    writeDb(db);
    const books = await catalog();
    const book = find(books, 'matematika-kelas-6');
    expect(book.used).toBe(true);
    expect(book.topics[0]).toMatchObject({ used: true });
    expect(book.topics[1]).toMatchObject({ used: false });
    expect((await errorOf(adm('/admin/books/matematika-kelas-6', 'DELETE'))).body.message).toMatch(
      /sudah dikerjakan/,
    );
    expect((await errorOf(adm('/admin/topics/matematika-kelas-6:T1', 'DELETE'))).status).toBe(409);
    // Level 1 sudah dikerjakan; level 2 belum, jadi level 2 (yang paling akhir) masih bisa dihapus.
    expect(
      (await errorOf(adm('/admin/levels/matematika-kelas-6:T1:1', 'DELETE'))).body.message,
    ).toMatch(/sudah dikerjakan/);
    await adm('/admin/levels/matematika-kelas-6:T1:2', 'DELETE');
    // Topik kedua belum dikerjakan, jadi bisa dihapus.
    await adm('/admin/topics/matematika-kelas-6:T2', 'DELETE');
  });

  it('buku buatan admin yang belum dikerjakan bisa dihapus bersama isinya', async () => {
    await adm('/admin/books', 'POST', {
      subject: 'science',
      grade: 2,
      title: 'Sains Kelas 2',
      topic: newTopic(),
    });
    await adm('/admin/topics/sains-kelas-2:T1/levels', 'POST', { title: 'Tambahan' });
    const books = await adm<CatalogBook[]>('/admin/books/sains-kelas-2', 'DELETE');
    expect(books.some((b) => b.slug === 'sains-kelas-2')).toBe(false);
    expect(readDb().contentEdits.added).toMatchObject({ books: [], topics: [], levels: [] });
  });
});

/** Halaman Silabus Belajar. */
function renderPage() {
  return render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>,
  );
}

const firstBook = async () => {
  const toggle = await screen.findByRole('button', { name: 'Buka atau tutup Matematika Kelas 1' });
  return toggle.closest('.syl-book') as HTMLElement;
};

describe('Silabus Belajar: halaman', () => {
  it('menampilkan angka ringkas, aturan akses, dan buku pertama yang terbuka', async () => {
    renderPage();
    const book = await firstBook();
    expect(await screen.findByText('Akses berbayar')).toBeInTheDocument();
    expect(screen.getByText('Level 1–2 gratis, level berikutnya Premium.')).toBeInTheDocument();
    expect(within(book).getAllByRole('button', { name: /^Ubah topik/ })).toHaveLength(10);
    // Buku lain tertutup.
    const sains = screen.getByRole('button', { name: 'Buka atau tutup Sains Kelas 1' });
    expect(sains).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(sains);
    expect(sains).toHaveAttribute('aria-expanded', 'true');
  });

  it('aturan akses disimpan dari halaman ini tanpa mengubah batas bayar pesanan', async () => {
    renderPage();
    const stepper = await screen.findByRole('spinbutton', { name: 'Level gratis per topik' });
    fireEvent.click(screen.getByRole('button', { name: 'Tambah' }));
    expect(stepper).toHaveValue(3);
    expect(screen.getByText('Level 1–3 gratis, level berikutnya Premium.')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Simpan akses' });
    fireEvent.click(save);
    expect(await screen.findByText('Aturan akses disimpan.')).toBeInTheDocument();
    expect(readDb().settings.billing).toMatchObject({
      paywall: true,
      freeLevels: 3,
      orderExpiryHours: 24,
    });
    expect(save).toBeDisabled();
    // Level 3 sekarang gratis di katalog.
    const first = find(await catalog(), 'matematika-kelas-1').topics[0]!;
    expect(first.levels.map((l) => l.free)).toEqual([true, true, true, false]);

    // Kunci berbayar dimatikan: semua gratis dan stepper terkunci.
    fireEvent.click(screen.getByRole('switch', { name: 'Kunci berbayar aktif' }));
    expect(screen.getByRole('spinbutton', { name: 'Level gratis per topik' })).toBeDisabled();
    expect(screen.getByText('Semua level gratis.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simpan akses' }));
    await waitFor(() => expect(readDb().settings.billing.paywall).toBe(false));
    expect(readDb().settings.billing.freeLevels).toBe(3);
  });

  it('level 3 dijadikan gratis ditandai sebagai pengecualian', async () => {
    renderPage();
    const book = await firstBook();
    fireEvent.click(within(book).getByRole('button', { name: 'Ubah topik Bilangan sampai 100' }));
    const access = await screen.findByRole('group', { name: 'Akses level 3' });
    expect(within(access).getByRole('button', { name: 'Premium' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Level 1 selalu gratis: pilihan Premium terkunci.
    expect(
      within(screen.getByRole('group', { name: 'Akses level 1' })).getByRole('button', {
        name: 'Premium',
      }),
    ).toBeDisabled();
    fireEvent.click(within(access).getByRole('button', { name: 'Gratis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan topik' }));
    expect(await screen.findByText('Topik Bilangan sampai 100 tersimpan.')).toBeInTheDocument();
    expect(await screen.findByText('Pengecualian')).toBeInTheDocument();
    expect(readDb().contentEdits.levels['matematika-kelas-1:A:3']?.isFree).toBe(true);
  });

  it('topik bawaan tidak punya tombol hapus, tetapi tiap levelnya bisa disesuaikan soalnya', async () => {
    renderPage();
    const book = await firstBook();
    fireEvent.click(within(book).getByRole('button', { name: 'Ubah topik Bilangan sampai 100' }));
    await screen.findByRole('group', { name: 'Akses level 3' });
    expect(screen.queryByRole('button', { name: /Hapus topik/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Tulis soal level/ })).toBeNull();
    expect(screen.getAllByText('Soal otomatis')).toHaveLength(4);
    for (const n of [1, 2, 3, 4])
      expect(screen.getByRole('button', { name: `Sesuaikan soal level ${n}` })).toBeInTheDocument();
  });

  it('tambah topik lewat dialog: isian keliru ditandai, isian benar langsung terbuka di daftar', async () => {
    renderPage();
    const book = await firstBook();
    fireEvent.click(within(book).getByRole('button', { name: 'Tambah topik' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Tambah topik ke Matematika Kelas 1',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buat topik' }));
    // Pesan tampil di bawah isiannya dan juga di ringkasan galat.
    expect(
      (await within(dialog).findAllByText('Judul topik minimal 2 huruf.')).length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Materi singkat wajib diisi.').length).toBeGreaterThan(0);

    fireEvent.change(within(dialog).getByLabelText(/Judul topik/), {
      target: { value: 'Mengenal bentuk' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Materi singkat/), {
      target: { value: 'Ada bentuk bulat dan kotak.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Tahukah kamu/), {
      target: { value: 'Bola bulat.\n\nBuku kotak.' },
    });
    // Dua level cukup: hapus dua baris bawaan.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus level 4' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus level 3' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buat topik' }));

    expect(
      await screen.findByText('Topik Mengenal bentuk ditambahkan ke Matematika Kelas 1.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const row = within(book).getByRole('button', { name: 'Ubah topik Mengenal bentuk' });
    expect(within(row).getByText('Buatan admin')).toBeInTheDocument();
    expect(row).toHaveTextContent('2 level · 2 gratis');
    expect(readDb().contentEdits.added?.topics[0]?.topic).toMatchObject({
      code: 'T1',
      tips: ['Bola bulat.', 'Buku kotak.'],
    });
  });

  it('tulis soal sebuah level: kurang dari 4 soal ditolak, 4 soal lengkap membuat level siap', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
    renderPage();
    const book = await firstBook();
    fireEvent.click(within(book).getByRole('button', { name: 'Ubah topik Mengenal bentuk' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tulis soal level 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Soal level 1: Bentuk dasar' });

    // Kosong: simpan menampilkan isu, belum ada yang terkirim.
    expect(await within(dialog).findByText('0 dari 4 soal sudah lengkap')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan soal' }));
    expect(
      await within(dialog).findByText('Masih ada isian yang perlu diperbaiki.'),
    ).toBeInTheDocument();
    expect(readDb().contentEdits.added?.topics[0]?.topic.levels[0]?.generator).toBeNull();

    const fill = (n: number, prompt: string, choices: string[]) => {
      fireEvent.change(within(dialog).getByLabelText(`Pertanyaan ${n}`), {
        target: { value: prompt },
      });
      choices.forEach((text, i) =>
        fireEvent.change(within(dialog).getByLabelText(`Pilihan ${i + 1}, Soal ${n}`), {
          target: { value: text },
        }),
      );
    };
    fill(1, 'Bola berbentuk apa?', ['Bulat', 'Kotak', 'Segitiga']);
    fill(2, 'Buku berbentuk apa?', ['Kotak', 'Bulat', 'Bintang']);
    fill(3, 'Roda berbentuk apa?', ['Kotak', 'Bulat', 'Segitiga']);
    fill(4, 'Jendela berbentuk apa?', ['Kotak', 'Bulat', 'Bintang']);
    // Soal 3: jawaban benarnya pilihan kedua (tiap soal punya kelompok bulatannya sendiri).
    fireEvent.click(within(dialog).getAllByRole('radio', { name: 'Jawaban benar: pilihan 2' })[2]!);
    expect(await within(dialog).findByText('4 dari 4 soal sudah lengkap')).toBeInTheDocument();
    expect(within(dialog).getByText('Sudah cukup untuk dimainkan anak.')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan soal' }));
    expect(
      await screen.findByText('Soal level 1 tersimpan (4 soal). Level sudah bisa dimainkan.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Soal level 1/ })).toBeNull());
    expect(await screen.findByText('4 soal')).toBeInTheDocument();
    const saved = readDb().contentEdits.added?.topics[0]?.topic.levels[0];
    expect(saved).toMatchObject({ generator: 'skill' });
    const stored = (saved?.generatorParams as { params: { items: { answer: number }[] } }).params
      .items;
    expect(stored.map((q) => q.answer)).toEqual([0, 0, 1, 0]);
  }, 20_000);

  it('mengetik di satu soal tidak menggambar ulang kartu soal lainnya', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
    renderPage();
    const book = await firstBook();
    fireEvent.click(within(book).getByRole('button', { name: 'Ubah topik Mengenal bentuk' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tulis soal level 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Soal level 1: Bentuk dasar' });
    const first = await within(dialog).findByLabelText('Pertanyaan 1');

    // Tiap kali sebuah kartu digambar, judul "Soal n" dibuat ulang lewat t(); kartu yang tidak digambar tidak memanggilnya.
    const spy = vi.spyOn(i18n, 't');
    const drawn = (n: number) =>
      spy.mock.calls.filter(
        ([key, params]) =>
          key === 'admin.bank.question' && (params as { n?: number } | undefined)?.n === n,
      ).length;
    for (const text of ['B', 'Bo', 'Bol', 'Bola'])
      fireEvent.change(first, { target: { value: text } });
    expect(first).toHaveValue('Bola');
    expect(drawn(1)).toBeGreaterThan(0);
    for (const other of [2, 3, 4]) expect(drawn(other)).toBe(0);

    // Mengubah daftar (tambah soal) tetap menggambar kartu baru.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah soal' }));
    expect(drawn(5)).toBeGreaterThan(0);
    spy.mockRestore();
  }, 20_000);

  it('tambah buku lewat dialog; pasangan mapel dan kelas yang sudah ada ditolak', async () => {
    renderPage();
    await firstBook();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah buku' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tambah buku' });
    expect(within(dialog).getByLabelText(/Judul buku/)).toHaveValue('Matematika Kelas 5');

    // Kelas 1 Matematika sudah ada: pesan tampil dan tombol buat terkunci.
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Kelas' }));
    fireEvent.click(screen.getByRole('option', { name: 'Kelas 1' }));
    expect(within(dialog).getByLabelText(/Judul buku/)).toHaveValue('Matematika Kelas 1');
    expect(
      within(dialog).getAllByText(/Buku untuk mapel dan kelas ini sudah ada/).length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Buat buku' })).toBeDisabled();

    // Sains Kelas 4 belum ada.
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Mapel' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sains' }));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Kelas' }));
    fireEvent.click(screen.getByRole('option', { name: 'Kelas 4' }));
    expect(within(dialog).getByLabelText(/Judul buku/)).toHaveValue('Sains Kelas 4');
    fireEvent.change(within(dialog).getByLabelText(/Judul topik/), {
      target: { value: 'Tumbuhan' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Materi singkat/), {
      target: { value: 'Tumbuhan butuh air dan cahaya.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buat buku' }));

    expect(
      await screen.findByText('Buku Sains Kelas 4 dibuat dengan topik pertamanya.'),
    ).toBeInTheDocument();
    const made = await screen.findByRole('button', { name: 'Buka atau tutup Sains Kelas 4' });
    expect(made).toHaveAttribute('aria-expanded', 'true');
    // Lencana "Buatan admin" ada di buku dan di topik pertamanya.
    expect(
      within(made.closest('.syl-book') as HTMLElement).getAllByText('Buatan admin').length,
    ).toBeGreaterThan(0);
    expect(readDb().contentEdits.added?.books[0]).toMatchObject({ slug: 'sains-kelas-4' });
  });

  it('hapus topik buatan admin lewat konfirmasi', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', newTopic());
    renderPage();
    const book = await firstBook();
    fireEvent.click(within(book).getByRole('button', { name: 'Ubah topik Mengenal bentuk' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus topik Mengenal bentuk' }));
    const confirm = await screen.findByRole('dialog', { name: 'Hapus topik Mengenal bentuk?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().contentEdits.added?.topics).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Hapus topik Mengenal bentuk' }));
    const again = await screen.findByRole('dialog', { name: 'Hapus topik Mengenal bentuk?' });
    fireEvent.click(within(again).getByRole('button', { name: 'Hapus topik' }));
    expect(await screen.findByText('Topik Mengenal bentuk dihapus.')).toBeInTheDocument();
    expect(readDb().contentEdits.added?.topics).toHaveLength(0);
    expect(within(book).queryByRole('button', { name: 'Ubah topik Mengenal bentuk' })).toBeNull();
  });
});
