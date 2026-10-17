import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BANK_DRAFT_SIZE,
  bankFromGenerator,
  bankFromLevel,
  bankToLevel,
  generateRound,
  levelSource,
  questionBankSchema,
  type BankQuestion,
} from '@udakids/engine';
import { CatalogPage } from '../src/admin/catalog/CatalogPage';
import type { CatalogBook, CatalogLevel } from '../src/api/adminTypes';
import { ApiError } from '../src/api/client';
import { handle } from '../src/api/mock/adminRoutes';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import type { LevelQuestions } from '../src/api/mock/syllabus';
import { startRound } from '../src/api/practice';
import { useSession } from '../src/auth/store';
import { BASE_BOOKS } from '../src/content/books';

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

const asAyu = () =>
  useSession.setState({ session: { token: 'mock-child:c-ayu', role: 'child', name: 'Ayu' } });

/** Level bawaan dari berkas konten: [id, level]. */
const allLevels = BASE_BOOKS.flatMap((b) =>
  b.topics.flatMap((t) => t.levels.map((l) => [`${b.slug}:${t.code}:${l.number}`, l] as const)),
);
const AUTO = 'matematika-kelas-1:A:1';
const URL_OF = (id: string) => `/admin/levels/${id}/questions`;
const find = (books: CatalogBook[], id: string): CatalogLevel => {
  const [slug, code, n] = id.split(':');
  return books
    .find((b) => b.slug === slug)!
    .topics.find((t) => t.code === code)!
    .levels.find((l) => String(l.number) === n)!;
};

beforeEach(() => {
  resetMockDb();
  useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
});

describe('soal generator disalin menjadi bank soal', () => {
  it('semua level bawaan menghasilkan bank yang sah, 20 soal (atau semua soal berbeda yang ada)', () => {
    const fewer: string[] = [];
    for (const [id, level] of allLevels) {
      if (levelSource(level) === 'none') continue;
      const items = bankFromGenerator(level);
      expect(items.length, id).toBeGreaterThanOrEqual(15);
      expect(questionBankSchema.safeParse(items).success, id).toBe(true);
      if (items.length < BANK_DRAFT_SIZE) fewer.push(id);
      // Dimainkan: satu ronde 10 soal, jawaban selalu ada di pilihan.
      const round = generateRound(bankToLevel(items), 3);
      expect(round, id).toHaveLength(10);
      for (const q of round) expect(q.options, id).toContain(q.answer);
    }
    // Hanya level yang ruang soalnya kecil yang kurang dari 20.
    expect(fewer.length).toBeLessThanOrEqual(5);
  });

  it('deterministik untuk seed yang sama, lain untuk seed lain, dan paling banyak seukuran yang diminta', () => {
    const level = BASE_BOOKS[0]!.topics[0]!.levels[0]!;
    const a = bankFromGenerator(level, { seed: 5 });
    expect(bankFromGenerator(level, { seed: 5 })).toEqual(a);
    expect(JSON.stringify(bankFromGenerator(level, { seed: 9 }))).not.toBe(JSON.stringify(a));
    expect(bankFromGenerator(level, { size: 6 })).toHaveLength(6);
    expect(bankFromGenerator({ generator: null })).toEqual([]);
    expect(bankFromGenerator({ generator: 'tidak-ada' })).toEqual([]);
  });

  it('soal isian angka menjadi pilihan ganda: jawaban benar ditambah pengecoh angka', () => {
    const level = BASE_BOOKS.find((b) => b.slug === 'matematika-kelas-4')!
      .topics.find((t) => t.code === 'I')!
      .levels.find((l) => l.number === 2)!;
    const spec = { generator: level.generator!, generatorParams: level.generatorParams as never };
    const number = generateRound(spec, 5).find((q) => q.type === 'number')!;
    expect(number.options).toBeNull();
    const items = bankFromGenerator(level, { seed: 5, size: 40 });
    const item = items.find((i) => i.prompt === number.prompt)!;
    expect(item.choices).toContain(number.answer);
    expect(item.choices.length).toBeGreaterThanOrEqual(2);
    expect(item.choices[item.answer]).toBe(number.answer);
    expect(new Set(item.choices).size).toBe(item.choices.length);
  });

  it('gambar benda hitung ikut tersalin dan tetap tampil saat bank dimainkan', () => {
    const level = allLevels
      .map(([, l]) => l)
      .find((l) => bankFromGenerator(l).some((q) => q.visual))!;
    const items = bankFromGenerator(level);
    const withVisual = items.filter((q) => q.visual);
    expect(withVisual.length).toBeGreaterThan(0);

    const playable = bankToLevel(items);
    const round = generateRound(playable, 4);
    expect(round.some((q) => q.visual !== null)).toBe(true);
    const back = bankFromLevel(playable)!;
    expect(back.filter((q) => q.visual)).toHaveLength(withVisual.length);
    expect(back.find((q) => q.visual)!.visual).toEqual(withVisual[0]!.visual);
  });

  it('kalimat yang sama dengan pilihan atau gambar lain adalah soal berbeda; yang kembar ditolak', () => {
    const base: BankQuestion = {
      prompt: 'Mana yang bisa terbang?',
      choices: ['Burung', 'Batu'],
      answer: 0,
      hint: '',
    };
    const others = [1, 2, 3].map((n) => ({ ...base, choices: ['Burung', `Benda ${n}`] }));
    expect(questionBankSchema.safeParse([base, ...others]).success).toBe(true);
    const twin = questionBankSchema.safeParse([base, base, ...others]);
    expect(twin.success).toBe(false);
    expect(twin.error?.issues[0]?.message).toBe('Soal ini sama persis dengan soal ke-1.');
    const pictures = [3, 4, 5, 6].map((count) => ({
      prompt: 'Ada berapa apel?',
      choices: ['3', '4', '5'],
      answer: 0,
      hint: '',
      visual: { item: 'apple' as const, count },
    }));
    expect(questionBankSchema.safeParse(pictures).success).toBe(true);
  });

  it('petunjuk panjang boleh (langkah hitung), kata terlarang tetap ditolak', () => {
    const long =
      'Kalau lupa, pakai fakta yang dekat: 7 × 3 = 21, lalu tambah satu kelompok 7. 21 + 7 = 28, jadi hasilnya 28.';
    const item: BankQuestion = {
      prompt: '7 × 4 = …',
      choices: ['21', '28'],
      answer: 1,
      hint: long,
    };
    const four = [item, ...[5, 6, 8].map((n) => ({ ...item, prompt: `${n} × 4 = …`, hint: long }))];
    expect(questionBankSchema.safeParse(four).success).toBe(true);
    const rude = four.map((q, i) => (i === 0 ? { ...q, hint: 'Itu salah ya.' } : q));
    expect(questionBankSchema.safeParse(rude).success).toBe(false);
  });
});

describe('Silabus Belajar: soal di semua level (API tiruan)', () => {
  it('level otomatis memberi 20 soal contoh (draf) yang belum menggantikan generator', async () => {
    const draft = await adm<LevelQuestions>(URL_OF(AUTO));
    expect(draft).toMatchObject({ draft: true, edited: false, regenerable: true, min: 4, max: 60 });
    expect(draft.items).toHaveLength(20);
    expect(questionBankSchema.safeParse(draft.items).success).toBe(true);
    // Masih otomatis: tidak ada yang tersimpan.
    expect(readDb().contentEdits.questions).toBeUndefined();
    const level = find(await adm<CatalogBook[]>('/admin/catalogs'), AUTO);
    expect(level).toMatchObject({ source: 'auto', edited: false, custom: false });
  });

  it('contoh baru dari generator memakai seed lain dan tidak mengubah apa pun', async () => {
    const first = await adm<LevelQuestions>(URL_OF(AUTO));
    const fresh = await adm<LevelQuestions>(`${URL_OF(AUTO)}?from=generator&seed=777`);
    expect(fresh.draft).toBe(true);
    expect(fresh.items).toHaveLength(20);
    expect(JSON.stringify(fresh.items)).not.toBe(JSON.stringify(first.items));
    expect(readDb().contentEdits.questions).toBeUndefined();
  });

  it('disimpan: level memakai bank itu, anak tetap mengerjakan 10 soal acak dari 20, dan bisa dikembalikan', async () => {
    const draft = await adm<LevelQuestions>(URL_OF(AUTO));
    const edited = draft.items.map((q, i) => ({
      ...q,
      prompt: `Soal sunting nomor ${i + 1}, berapa jumlahnya?`,
    }));
    const books = await adm<CatalogBook[]>(URL_OF(AUTO), 'PUT', { items: edited });
    expect(find(books, AUTO)).toMatchObject({
      source: 'bank',
      questions: 20,
      edited: true,
      custom: false,
    });
    expect(readDb().contentEdits.questions?.[AUTO]).toHaveLength(20);

    const after = await adm<LevelQuestions>(URL_OF(AUTO));
    expect(after).toMatchObject({ draft: false, edited: true, regenerable: true });
    expect(after.items.map((q) => q.prompt)).toEqual(edited.map((q) => q.prompt));

    // Anak: satu ronde = 10 soal berbeda dari bank itu, dan isi sunting yang tampil.
    asAyu();
    const round = await startRound(AUTO);
    expect(round.questions).toHaveLength(10);
    const prompts = round.questions.map((q) => q.prompt);
    expect(new Set(prompts).size).toBe(10);
    expect(prompts.every((p) => edited.some((q) => q.prompt === p))).toBe(true);
    expect(JSON.stringify(round)).not.toMatch(/"answer"/);
    // Level hitung bergambar: gambar bendanya ikut tampil di soal yang disunting.
    expect(round.questions.every((q) => q.visual !== null)).toBe(true);

    // Dikembalikan: generator aslinya berlaku lagi.
    useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
    const reverted = await adm<CatalogBook[]>(URL_OF(AUTO), 'DELETE');
    expect(find(reverted, AUTO)).toMatchObject({ source: 'auto', edited: false, questions: 0 });
    expect(readDb().contentEdits.questions).toEqual({});
    expect((await adm<LevelQuestions>(URL_OF(AUTO))).draft).toBe(true);
    asAyu();
    expect((await startRound(AUTO)).questions).toHaveLength(10);
  });

  it('level yang sudah dikerjakan anak tetap bisa disesuaikan dan dikembalikan', async () => {
    const db = readDb();
    db.passedLevels['c-ayu'] = [AUTO];
    writeDb(db);
    const draft = await adm<LevelQuestions>(URL_OF(AUTO));
    await adm(URL_OF(AUTO), 'PUT', { items: draft.items });
    await adm(URL_OF(AUTO), 'DELETE');
    expect(find(await adm<CatalogBook[]>('/admin/catalogs'), AUTO)).toMatchObject({
      used: true,
      source: 'auto',
    });
  });

  it('level dengan bank bawaan memberi isinya (bukan draf) dan bisa dikembalikan setelah disesuaikan', async () => {
    const books = await adm<CatalogBook[]>('/admin/catalogs');
    const bankLevel = books
      .flatMap((b) => b.topics.flatMap((t) => t.levels))
      .find((l) => l.source === 'bank' && !l.custom)!;
    const own = await adm<LevelQuestions>(URL_OF(bankLevel.id));
    expect(own).toMatchObject({ draft: false, edited: false, regenerable: false });
    expect(own.items).toHaveLength(bankLevel.questions);
    // Level seperti ini tidak punya generator untuk diambil ulang.
    expect((await errorOf(adm(`${URL_OF(bankLevel.id)}?from=generator`))).status).toBe(409);

    const changed = own.items.map((q, i) =>
      i === 0 ? { ...q, hint: 'Petunjuk baru dari admin.' } : q,
    );
    const after = await adm<CatalogBook[]>(URL_OF(bankLevel.id), 'PUT', { items: changed });
    expect(find(after, bankLevel.id)).toMatchObject({ source: 'bank', edited: true });
    expect((await adm<LevelQuestions>(URL_OF(bankLevel.id))).items[0]!.hint).toBe(
      'Petunjuk baru dari admin.',
    );
    const back = await adm<CatalogBook[]>(URL_OF(bankLevel.id), 'DELETE');
    expect(find(back, bankLevel.id)).toMatchObject({
      edited: false,
      questions: bankLevel.questions,
    });
    expect((await adm<LevelQuestions>(URL_OF(bankLevel.id))).items[0]!.hint).toBe(
      own.items[0]!.hint,
    );
  });

  it('menolak bank yang kurang atau keliru, dan mengembalikan level yang belum disesuaikan itu keliru', async () => {
    const draft = await adm<LevelQuestions>(URL_OF(AUTO));
    expect(
      (await errorOf(adm(URL_OF(AUTO), 'PUT', { items: draft.items.slice(0, 3) }))).status,
    ).toBe(400);
    const rude = draft.items.map((q, i) => (i === 2 ? { ...q, prompt: 'Mana yang salah?' } : q));
    const bad = await errorOf(adm(URL_OF(AUTO), 'PUT', { items: rude }));
    expect(bad.issues.map((i) => i.path)).toEqual(['2.prompt']);
    expect(readDb().contentEdits.questions).toBeUndefined();
    expect((await errorOf(adm(URL_OF(AUTO), 'DELETE'))).status).toBe(409);
  });

  it('level buatan admin tidak punya generator bawaan untuk diambil ulang', async () => {
    await adm('/admin/books/matematika-kelas-1/topics', 'POST', {
      title: 'Mengenal bentuk',
      lesson: 'Ada bentuk bulat dan kotak.',
      tips: [],
      levels: [{ title: 'Bentuk dasar' }],
    });
    const own = await adm<LevelQuestions>(URL_OF('matematika-kelas-1:T1:1'));
    expect(own).toMatchObject({ items: [], draft: false, regenerable: false, edited: false });
    expect((await errorOf(adm(`${URL_OF('matematika-kelas-1:T1:1')}?from=generator`))).status).toBe(
      409,
    );
  });
});

// ---- Tampilan ----

const renderPage = () =>
  render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>,
  );

const openLevel1 = async () => {
  const toggle = await screen.findByRole('button', { name: 'Buka atau tutup Matematika Kelas 1' });
  const book = toggle.closest('.syl-book') as HTMLElement;
  fireEvent.click(within(book).getByRole('button', { name: 'Ubah topik Bilangan sampai 100' }));
  return screen.findByRole('button', { name: 'Sesuaikan soal level 1' });
};

// Dialog dengan 20 kartu soal berat bagi jsdom: pencarian berdasarkan peran dan nama pada seluruh isinya lambat,
// jadi di sini yang dicari lewat teks atau atribut.
const buttonByText = (root: HTMLElement, text: string) =>
  within(root).getByText(text).closest('button') as HTMLButtonElement;

describe('Silabus Belajar: menyesuaikan soal level otomatis', () => {
  it('tombol di setiap level, dialog berisi 20 soal contoh, disimpan lalu bisa dikembalikan', async () => {
    renderPage();
    fireEvent.click(await openLevel1());
    const dialog = await screen.findByRole('dialog', { name: /^Soal level 1:/ });
    expect(await within(dialog).findByText('20 dari 20 soal sudah lengkap')).toBeInTheDocument();
    expect(dialog.querySelectorAll('.bank-q')).toHaveLength(20);
    expect(
      within(dialog).getByText(/20 soal contoh dari soal otomatis level ini/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Ambil contoh baru')).toBeInTheDocument();
    // Belum pernah disesuaikan: tidak ada tombol kembalikan dan kosongkan.
    expect(within(dialog).queryByText('Kembalikan ke soal bawaan')).toBeNull();
    expect(within(dialog).queryByText('Kosongkan soal')).toBeNull();

    fireEvent.change(
      dialog.querySelector('input[aria-label="Petunjuk saat belum tepat (opsional) 1"]')!,
      { target: { value: 'Hitung pelan-pelan, ya.' } },
    );
    fireEvent.click(buttonByText(dialog, 'Simpan soal'));
    expect(
      await screen.findByText('Soal level 1 tersimpan (20 soal). Level sudah bisa dimainkan.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().contentEdits.questions?.[AUTO]?.[0]?.hint).toBe('Hitung pelan-pelan, ya.');

    // Kini level memakai bank soal: lencana, penanda "Disesuaikan", dan tombol berganti nama.
    const edit = await screen.findByRole('button', { name: 'Ubah soal level 1' });
    const row = edit.closest('li')!;
    expect(within(row).getByText('20 soal')).toBeInTheDocument();
    expect(within(row).getByText('Disesuaikan')).toBeInTheDocument();

    fireEvent.click(edit);
    const again = await screen.findByRole('dialog', { name: /^Soal level 1:/ });
    expect(await within(again).findByText(/sudah kamu sesuaikan/)).toBeInTheDocument();
    expect(within(again).queryByText(/soal contoh dari soal otomatis/)).toBeNull();
    fireEvent.click(buttonByText(again, 'Kembalikan ke soal bawaan'));
    const confirm = await screen.findByRole('dialog', { name: 'Kembalikan soal level 1?' });
    fireEvent.click(within(confirm).getByText('Kembalikan ke soal bawaan'));
    expect(
      await screen.findByText('Soal level 1 dikembalikan ke soal bawaan.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      await screen.findByRole('button', { name: 'Sesuaikan soal level 1' }),
    ).toBeInTheDocument();
    expect(readDb().contentEdits.questions).toEqual({});
  }, 40_000);

  it('Ambil contoh baru mengganti soal contoh tanpa menyimpan apa pun', async () => {
    renderPage();
    fireEvent.click(await openLevel1());
    const dialog = await screen.findByRole('dialog', { name: /^Soal level 1:/ });
    const choices = () =>
      [...dialog.querySelectorAll<HTMLInputElement>('.bank-q .bank-choice input[type="text"]')]
        .map((el) => el.value)
        .join('|');
    await within(dialog).findByText('20 dari 20 soal sudah lengkap');
    const before = choices();
    fireEvent.click(buttonByText(dialog, 'Ambil contoh baru'));
    await waitFor(() => expect(choices()).not.toBe(before));
    expect(dialog.querySelectorAll('.bank-q')).toHaveLength(20);
    expect(readDb().contentEdits.questions).toBeUndefined();
  }, 40_000);
});

describe('Silabus Belajar: pop-up ya atau tidak di dialog soal (bukan kotak bawaan peramban)', () => {
  const HINT = 'input[aria-label="Petunjuk saat belum tepat (opsional) 1"]';
  const nativeConfirm = vi.fn(() => true);
  beforeEach(() => {
    nativeConfirm.mockClear();
    vi.spyOn(window, 'confirm').mockImplementation(nativeConfirm);
  });
  afterEach(() => {
    expect(nativeConfirm).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('menutup dialog yang soalnya diubah: Tidak tetap mengedit, Ya menutup', async () => {
    renderPage();
    fireEvent.click(await openLevel1());
    const dialog = await screen.findByRole('dialog', { name: /^Soal level 1:/ });
    await within(dialog).findByText('20 dari 20 soal sudah lengkap');

    fireEvent.change(dialog.querySelector(HINT)!, { target: { value: 'Hitung pelan-pelan, ya.' } });
    fireEvent.click(buttonByText(dialog, 'Tutup'));
    const ask = await screen.findByRole('dialog', { name: 'Tutup tanpa menyimpan?' });
    expect(
      within(ask).getByText('Soal yang diubah belum disimpan. Tutup tanpa menyimpan?'),
    ).toBeInTheDocument();
    fireEvent.click(within(ask).getByRole('button', { name: 'Tidak, lanjut mengedit' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Tutup tanpa menyimpan?' })).toBeNull(),
    );
    expect(screen.getByRole('dialog', { name: /^Soal level 1:/ })).toBeInTheDocument();
    expect((dialog.querySelector(HINT) as HTMLInputElement).value).toBe('Hitung pelan-pelan, ya.');

    fireEvent.click(buttonByText(dialog, 'Tutup'));
    const again = await screen.findByRole('dialog', { name: 'Tutup tanpa menyimpan?' });
    fireEvent.click(within(again).getByRole('button', { name: 'Ya, tutup' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().contentEdits.questions).toBeUndefined();
  }, 40_000);

  it('menutup dialog tanpa perubahan tidak bertanya apa pun', async () => {
    renderPage();
    fireEvent.click(await openLevel1());
    const dialog = await screen.findByRole('dialog', { name: /^Soal level 1:/ });
    await within(dialog).findByText('20 dari 20 soal sudah lengkap');
    fireEvent.click(buttonByText(dialog, 'Tutup'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }, 40_000);

  it('Ambil contoh baru setelah mengubah soal bertanya dulu: Tidak mempertahankan, Ya mengganti', async () => {
    renderPage();
    fireEvent.click(await openLevel1());
    const dialog = await screen.findByRole('dialog', { name: /^Soal level 1:/ });
    await within(dialog).findByText('20 dari 20 soal sudah lengkap');
    const choices = () =>
      [...dialog.querySelectorAll<HTMLInputElement>('.bank-q .bank-choice input[type="text"]')]
        .map((el) => el.value)
        .join('|');

    fireEvent.change(dialog.querySelector(HINT)!, { target: { value: 'Petunjuk saya.' } });
    const before = choices();
    fireEvent.click(buttonByText(dialog, 'Ambil contoh baru'));
    const ask = await screen.findByRole('dialog', { name: 'Ganti dengan soal contoh baru?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Tidak, pakai soal saya' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Ganti dengan soal contoh baru?' })).toBeNull(),
    );
    expect((dialog.querySelector(HINT) as HTMLInputElement).value).toBe('Petunjuk saya.');
    expect(choices()).toBe(before);

    fireEvent.click(buttonByText(dialog, 'Ambil contoh baru'));
    const again = await screen.findByRole('dialog', { name: 'Ganti dengan soal contoh baru?' });
    fireEvent.click(within(again).getByRole('button', { name: 'Ya, ganti soal' }));
    await waitFor(() => expect(choices()).not.toBe(before));
    expect((dialog.querySelector(HINT) as HTMLInputElement).value).not.toBe('Petunjuk saya.');
  }, 40_000);
});
