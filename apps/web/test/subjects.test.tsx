import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogPage } from '../src/admin/catalog/CatalogPage';
import { CUSTOM_SUBJECT, subjectOptions } from '../src/admin/catalog/subjects';
import type { CatalogBook } from '../src/api/adminTypes';
import { ApiError } from '../src/api/client';
import { book as childBook, home } from '../src/api/catalog';
import { handle } from '../src/api/mock/adminRoutes';
import { readDb, resetMockDb } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';
import { mapelOf, mapelOfSlug } from '../src/lib/mapel';

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

const topic = (title = 'Greetings') => ({
  title,
  lesson: 'Kita belajar menyapa teman dalam bahasa Inggris.',
  tips: ['Hello artinya halo.'],
  levels: [{ title: 'Hello' }, { title: 'Good morning' }],
});
const newBook = (subject: string, grade = 5) => ({
  subject,
  grade,
  title: `${subject} Kelas ${grade}`,
  topic: topic(),
});
const find = (books: CatalogBook[], slug: string) => books.find((b) => b.slug === slug)!;

beforeEach(() => {
  resetMockDb();
  useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
});

describe('pilihan mapel', () => {
  it('mapel standar lebih dulu, lalu mapel lain dari katalog tanpa duplikat dan urut nama', () => {
    expect(subjectOptions([])).toEqual([
      { value: 'math', label: 'Matematika' },
      { value: 'science', label: 'Sains' },
      { value: 'Bahasa Inggris', label: 'Bahasa Inggris' },
    ]);
    expect(
      subjectOptions([
        { subject: 'math' },
        { subject: 'Seni Budaya' },
        { subject: 'english' },
        { subject: 'Coding' },
        { subject: 'seni-budaya' },
      ]).map((o) => o.label),
    ).toEqual(['Matematika', 'Sains', 'Bahasa Inggris', 'Coding', 'Seni Budaya']);
    expect(CUSTOM_SUBJECT).toBe('__custom__');
  });

  it('warna mapel di area anak: Matematika, Sains, dan mapel lain', () => {
    expect(mapelOf('math')).toBe('matematika');
    expect(mapelOf('science')).toBe('sains');
    expect(mapelOf('Bahasa Inggris')).toBe('umum');
    expect(mapelOf(undefined)).toBe('matematika');
    expect(mapelOfSlug('matematika-kelas-1:A:1')).toBe('matematika');
    expect(mapelOfSlug('sains-kelas-1')).toBe('sains');
    expect(mapelOfSlug('bahasa-inggris-kelas-5:T1')).toBe('umum');
  });
});

describe('buku dengan mapel baru (API tiruan)', () => {
  it('mapel baru memakai alamat dan nama yang rapi, dan tersimpan sebagai namanya', async () => {
    const books = await adm<CatalogBook[]>('/admin/books', 'POST', newBook('  Bahasa  Inggris '));
    const made = find(books, 'bahasa-inggris-kelas-5');
    expect(made).toMatchObject({ subject: 'Bahasa Inggris', grade: 5, custom: true });
    expect(readDb().contentEdits.added?.books[0]).toMatchObject({
      slug: 'bahasa-inggris-kelas-5',
      subject: 'Bahasa Inggris',
      grade: 'sd5',
    });

    // Kelas lain untuk mapel yang sama, dan mapel lain yang namanya memuat tanda baca.
    const more = await adm<CatalogBook[]>('/admin/books', 'POST', newBook('Bahasa Inggris', 6));
    expect(find(more, 'bahasa-inggris-kelas-6')).toBeTruthy();
    const art = await adm<CatalogBook[]>('/admin/books', 'POST', newBook('Seni & Budaya'));
    expect(find(art, 'seni-dan-budaya-kelas-5')).toMatchObject({ subject: 'Seni & Budaya' });
  });

  it('Matematika dan Sains tetap tersimpan sebagai kode lama, bahasa Indonesia atau Inggris', async () => {
    const math = await adm<CatalogBook[]>('/admin/books', 'POST', newBook('Matematika', 5));
    expect(find(math, 'matematika-kelas-5').subject).toBe('math');
    const science = await adm<CatalogBook[]>('/admin/books', 'POST', newBook('science', 5));
    expect(find(science, 'sains-kelas-5').subject).toBe('science');
  });

  it('satu buku untuk satu pasangan mapel dan kelas, apa pun cara menulis mapelnya', async () => {
    await adm('/admin/books', 'POST', newBook('Bahasa Inggris'));
    for (const again of ['english', 'English', 'bahasa inggris', ' BAHASA   INGGRIS '])
      expect((await errorOf(adm('/admin/books', 'POST', newBook(again)))).status).toBe(409);
    expect((await errorOf(adm('/admin/books', 'POST', newBook('math', 1)))).status).toBe(409);
  });

  it('nama mapel yang kosong atau tanpa huruf dan angka ditolak per isian', async () => {
    for (const subject of ['', '   ', '!!!']) {
      const bad = await errorOf(adm('/admin/books', 'POST', newBook(subject)));
      expect(bad.status).toBe(400);
      expect(bad.issues.map((i) => i.path)).toContain('subject');
    }
    const long = await errorOf(adm('/admin/books', 'POST', newBook('x'.repeat(41))));
    expect(long.issues.map((i) => i.path)).toContain('subject');
  });

  it('buku mapel baru terurut setelah Matematika dan Sains di kelas yang sama', async () => {
    await adm('/admin/books', 'POST', newBook('Coding'));
    await adm('/admin/books', 'POST', newBook('Sains'));
    const books = await adm<CatalogBook[]>('/admin/books', 'POST', newBook('Matematika'));
    const fifth = books.filter((b) => b.grade === 5).map((b) => b.slug);
    expect(fifth).toEqual(['matematika-kelas-5', 'sains-kelas-5', 'coding-kelas-5']);
  });

  it('anak melihat buku mapel baru di beranda dan di detail bukunya', async () => {
    await adm('/admin/books', 'POST', newBook('Bahasa Inggris'));
    useSession.setState({ session: { token: 'mock-child:c-ayu', role: 'child', name: 'Ayu' } });
    const shelf = (await home()).books.find((b) => b.slug === 'bahasa-inggris-kelas-5');
    expect(shelf).toMatchObject({ subject: 'Bahasa Inggris', grade: 5, topicsTotal: 1 });
    const detail = await childBook('bahasa-inggris-kelas-5');
    expect(detail.book).toMatchObject({
      title: 'Bahasa Inggris Kelas 5',
      subject: 'Bahasa Inggris',
    });
  });
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>,
  );

const openAddBook = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Tambah buku' }));
  return screen.findByRole('dialog', { name: 'Tambah buku' });
};
const optionLabels = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('Tambah buku: mata pelajaran dinamis', () => {
  it('dropdown mapel menawarkan mapel standar dan opsi tambah lainnya di paling bawah', async () => {
    renderPage();
    const dialog = await openAddBook();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Mapel' }));
    expect(optionLabels()).toEqual([
      'Matematika',
      'Sains',
      'Bahasa Inggris',
      '+ Tambah mata pelajaran lainnya…',
    ]);
  });

  it('mapel sendiri: nama baru memberi judul dan alamat buku, lalu otomatis ada di pilihan berikutnya', async () => {
    renderPage();
    let dialog = await openAddBook();
    expect(within(dialog).queryByLabelText(/Nama mata pelajaran baru/)).toBeNull();

    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Mapel' }));
    fireEvent.click(screen.getByRole('option', { name: '+ Tambah mata pelajaran lainnya…' }));
    const name = within(dialog).getByLabelText(/Nama mata pelajaran baru/);
    expect(name).toHaveFocus();

    // Belum diisi: tidak bisa dibuat, dan alasannya tampil.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buat buku' }));
    expect(
      (await within(dialog).findAllByText('Pilih atau tulis nama mata pelajaran.')).length,
    ).toBeGreaterThan(0);

    fireEvent.change(name, { target: { value: 'Seni Budaya' } });
    expect(within(dialog).getByLabelText(/Judul buku/)).toHaveValue('Seni Budaya Kelas 5');
    expect(within(dialog).getByText(/Alamat buku: seni-budaya-kelas-5/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Judul topik/), {
      target: { value: 'Menggambar bentuk' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Materi singkat/), {
      target: { value: 'Kita menggambar bentuk bulat dan kotak.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buat buku' }));

    expect(
      await screen.findByText('Buku Seni Budaya Kelas 5 dibuat dengan topik pertamanya.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readDb().contentEdits.added?.books[0]).toMatchObject({
      slug: 'seni-budaya-kelas-5',
      subject: 'Seni Budaya',
    });
    const made = screen.getByRole('button', { name: 'Buka atau tutup Seni Budaya Kelas 5' });
    expect(within(made).getByText('Seni Budaya', { selector: '.ui-badge' })).toBeInTheDocument();

    // Buku berikutnya: mapel itu sudah ada di dropdown, tidak perlu mengetiknya lagi.
    dialog = await openAddBook();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Mapel' }));
    expect(optionLabels()).toEqual([
      'Matematika',
      'Sains',
      'Bahasa Inggris',
      'Seni Budaya',
      '+ Tambah mata pelajaran lainnya…',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Seni Budaya' }));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Kelas' }));
    fireEvent.click(screen.getByRole('option', { name: 'Kelas 6' }));
    expect(within(dialog).getByLabelText(/Judul buku/)).toHaveValue('Seni Budaya Kelas 6');
    expect(within(dialog).queryByLabelText(/Nama mata pelajaran baru/)).toBeNull();
  });

  it('mapel standar Bahasa Inggris langsung bisa dipakai, dan mapel yang sudah punya buku di kelas itu ditolak', async () => {
    renderPage();
    const dialog = await openAddBook();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Mapel' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bahasa Inggris' }));
    expect(within(dialog).getByLabelText(/Judul buku/)).toHaveValue('Bahasa Inggris Kelas 5');

    // Menulis nama mapel yang sama lewat "tambah lainnya" tetap dikenali sebagai mapel yang sama.
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Mapel' }));
    fireEvent.click(screen.getByRole('option', { name: '+ Tambah mata pelajaran lainnya…' }));
    fireEvent.change(within(dialog).getByLabelText(/Nama mata pelajaran baru/), {
      target: { value: 'Matematika' },
    });
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Kelas' }));
    fireEvent.click(screen.getByRole('option', { name: 'Kelas 1' }));
    expect(within(dialog).getByLabelText(/Judul buku/)).toHaveValue('Matematika Kelas 1');
    expect(
      within(dialog).getAllByText(/Buku untuk mapel dan kelas ini sudah ada/).length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Buat buku' })).toBeDisabled();
  });
});
