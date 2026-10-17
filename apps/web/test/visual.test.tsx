import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Illustration } from '@udakids/engine';
import { CatalogPage } from '../src/admin/catalog/CatalogPage';
import * as imageFile from '../src/admin/catalog/questionImageFile';
import { svgToQuestionImage } from '../src/admin/media/svgImage';
import type { CatalogBook } from '../src/api/adminTypes';
import { handle } from '../src/api/mock/adminRoutes';
import { readDb, resetMockDb } from '../src/api/mock/db';
import type { LevelQuestions } from '../src/api/mock/syllabus';
import { CountObjects } from '../src/components/CountObjects';
import { useSession } from '../src/auth/store';
import { startRound } from '../src/api/practice';
import { RoundPage } from '../src/play/RoundPage';

vi.mock('../src/admin/catalog/questionImageFile', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/admin/catalog/questionImageFile')>();
  return { ...real, processQuestionImage: vi.fn() };
});

const ADMIN = 'mock-admin:a-demo';
const AUTO = 'matematika-kelas-1:A:1';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const adm = <T,>(path: string, method = 'GET', body?: Record<string, unknown>) =>
  handle<T>(path, method, body, ADMIN);

beforeEach(() => {
  resetMockDb();
  vi.mocked(imageFile.processQuestionImage).mockReset();
  useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
});

describe('CountObjects: benda hitung dan gambar', () => {
  it('benda hitung tetap digandakan dan diberi nama; kosong tidak menggambar apa pun', () => {
    const { container, rerender } = render(<CountObjects visual={{ item: 'apple', count: 4 }} />);
    expect(screen.getByRole('img', { name: '4 apel' })).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(4);
    rerender(<CountObjects visual={{ item: 'fish', groups: [3, 2] }} />);
    expect(screen.getByRole('img', { name: '5 ikan' })).toBeInTheDocument();
    expect(container.querySelectorAll('.uk-count-group')).toHaveLength(2);
    rerender(<CountObjects visual={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('gambar utuh tampil sebagai <img> yang muat di layar, dengan keterangan atau teks bawaan', () => {
    const { rerender } = render(
      <CountObjects visual={{ kind: 'image', url: PNG, label: 'Tiga apel merah' }} />,
    );
    const img = screen.getByRole('img', { name: 'Tiga apel merah' }) as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe(PNG);
    expect(img.style.maxHeight).toBe('180px');
    expect(img.style.maxWidth).toBe('100%');
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.display).toBe('block');
    rerender(<CountObjects visual={{ kind: 'image', url: PNG }} maxHeight={120} />);
    const plain = screen.getByRole('img', { name: 'Gambar soal' }) as HTMLImageElement;
    expect(plain.style.maxHeight).toBe('120px');
  });
});

describe('svgToQuestionImage: SVG halaman menjadi gambar soal', () => {
  it('memberi ukuran bawaan dari viewBox dan hasilnya Data URL SVG yang sah', () => {
    const host = document.createElement('div');
    host.innerHTML =
      '<svg viewBox="0 0 32 32" width="72" height="72" role="img" aria-label="Apel"><circle cx="16" cy="16" r="11" fill="#c0392b"/></svg>';
    const url = svgToQuestionImage(host.querySelector('svg')!, 320)!;
    expect(url).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/);
    const text = atob(url.split(',')[1]!);
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(text).toContain('width="320"');
    expect(text).toContain('height="320"');
    expect(text).toContain('fill="#c0392b"');
  });

  it('huruf bukan ASCII di keterangan tidak merusak kode, dan hasil yang kelewat besar ditolak', () => {
    const host = document.createElement('div');
    host.innerHTML = `<svg viewBox="0 0 320 240" aria-label="Pisang goréng"><text>é</text></svg>`;
    const url = svgToQuestionImage(host.querySelector('svg')!)!;
    const bytes = Uint8Array.from(atob(url.split(',')[1]!), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toContain('Pisang goréng');
    const huge = document.createElement('div');
    huge.innerHTML = `<svg viewBox="0 0 10 10"><desc>${'x'.repeat(300_000)}</desc></svg>`;
    expect(svgToQuestionImage(huge.querySelector('svg')!)).toBeNull();
  });
});

describe('processQuestionImage: pemeriksaan berkas', () => {
  it('menolak jenis selain PNG, JPG, WebP dan berkas di atas 3 MB sebelum membacanya', async () => {
    const real = await vi.importActual<typeof imageFile>('../src/admin/catalog/questionImageFile');
    expect(
      await real.processQuestionImage(new File(['x'], 'a.gif', { type: 'image/gif' })),
    ).toEqual({
      ok: false,
      problem: 'type',
    });
    expect(
      await real.processQuestionImage(new File(['x'], 'a.pdf', { type: 'application/pdf' })),
    ).toEqual({ ok: false, problem: 'type' });
    const big = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: real.QUESTION_IMAGE_MAX_BYTES + 1 });
    expect(await real.processQuestionImage(big)).toEqual({ ok: false, problem: 'size' });
  });
});

// ---- Dialog soal ----

const renderPage = () =>
  render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>,
  );

const openBank = async () => {
  renderPage();
  const toggle = await screen.findByRole('button', { name: 'Buka atau tutup Matematika Kelas 1' });
  const book = toggle.closest('.syl-book') as HTMLElement;
  fireEvent.click(within(book).getByRole('button', { name: 'Ubah topik Bilangan sampai 100' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Sesuaikan soal level 1' }));
  const dialog = await screen.findByRole('dialog', { name: /^Soal level 1:/ });
  await within(dialog).findByText('20 dari 20 soal sudah lengkap');
  return dialog;
};

/** Editor gambar kartu soal ke-`i` (mulai 0). Pencarian dibatasi pada satu kartu supaya cepat di jsdom. */
const editorOf = (dialog: HTMLElement, i = 0) => {
  const card = dialog.querySelectorAll<HTMLElement>('.bank-q')[i]!;
  return within(card.querySelector<HTMLElement>('.bank-visual')!);
};
const savedVisual = (i = 0) => readDb().contentEdits.questions?.[AUTO]?.[i]?.visual;
const save = async (dialog: HTMLElement) => {
  fireEvent.click(within(dialog).getByText('Simpan soal').closest('button')!);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
};

describe('dialog soal: editor gambar (bukan lagi terkunci)', () => {
  it('soal berhitung bergambar tidak terkunci: ada pilihan benda, jumlah, galeri, unggah, dan lepas', async () => {
    const dialog = await openBank();
    expect(within(dialog).queryByText(/tidak bisa diubah di sini/)).toBeNull();
    const ed = editorOf(dialog);
    expect(ed.getByText('Gambar soal')).toBeInTheDocument();
    expect(ed.getByRole('combobox', { name: 'Benda, Soal 1' })).toBeInTheDocument();
    expect(ed.getByRole('spinbutton', { name: 'Jumlah benda, Soal 1' })).toBeInTheDocument();
    for (const name of [
      'Benda hitung, Soal 1',
      'Pilih dari galeri, Soal 1',
      'Unggah gambar, Soal 1',
      'Lepas gambar, Soal 1',
    ])
      expect(ed.getByRole('button', { name })).toBeEnabled();
    // Soal tanpa gambar juga bisa diberi gambar.
    expect(dialog.querySelectorAll('.bank-visual')).toHaveLength(20);
  }, 40_000);

  it('ganti jenis benda dari ikan ke apel dan ubah jumlahnya: pratinjau langsung mengikuti', async () => {
    const dialog = await openBank();
    const ed = editorOf(dialog);
    const was = ed.getByRole('img').getAttribute('aria-label')!;
    expect(was).toMatch(/^\d+ ikan$/);

    fireEvent.click(ed.getByRole('combobox', { name: 'Benda, Soal 1' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Apel' }));
    expect(ed.getByRole('img').getAttribute('aria-label')).toMatch(/^\d+ apel$/);

    fireEvent.change(ed.getByRole('spinbutton', { name: 'Jumlah benda, Soal 1' }), {
      target: { value: '7' },
    });
    expect(ed.getByRole('img')).toHaveAttribute('aria-label', '7 apel');
    expect(ed.getByText(/^Ada 7 apel di gambar./)).toBeInTheDocument();
    expect(ed.getByText(/Pertanyaan dan jawaban benar tidak ikut berubah/)).toBeInTheDocument();
    expect(dialog.querySelectorAll('.bank-q')[0]!.querySelectorAll('.uk-count svg')).toHaveLength(
      7,
    );

    await save(dialog);
    expect(savedVisual()).toEqual({ item: 'apple', count: 7 });
  }, 40_000);

  it('kelompok: tambah kelompok kedua, jumlah seluruhnya paling banyak 30, hapus kelompok', async () => {
    const dialog = await openBank();
    const ed = editorOf(dialog);
    fireEvent.change(ed.getByRole('spinbutton', { name: 'Jumlah benda, Soal 1' }), {
      target: { value: '3' },
    });
    fireEvent.click(ed.getByRole('button', { name: 'Tambah kelompok, Soal 1' }));
    const second = ed.getByRole('spinbutton', { name: 'Jumlah benda kelompok 2, Soal 1' });
    fireEvent.change(second, { target: { value: '2' } });
    expect(ed.getByRole('img').getAttribute('aria-label')).toMatch(/^5 /);
    expect(ed.getAllByRole('spinbutton')).toHaveLength(2);
    // Kelompok kedua tidak boleh melewati sisa jatah 30 benda.
    expect(second).toHaveAttribute('max', '27');

    fireEvent.click(ed.getByRole('button', { name: 'Hapus kelompok 2, Soal 1' }));
    expect(ed.getAllByRole('spinbutton')).toHaveLength(1);
    expect(ed.getByRole('img').getAttribute('aria-label')).toMatch(/^3 /);

    fireEvent.click(ed.getByRole('button', { name: 'Tambah kelompok, Soal 1' }));
    fireEvent.click(ed.getByRole('button', { name: 'Tambah kelompok, Soal 1' }));
    expect(ed.queryByRole('button', { name: 'Tambah kelompok, Soal 1' })).toBeNull();
    await save(dialog);
    expect(savedVisual()).toMatchObject({ groups: [3, 1, 1] });
  }, 40_000);

  it('lepas gambar menjadikan soal teks murni, dan Benda hitung memasang gambar benda lagi', async () => {
    const dialog = await openBank();
    const ed = editorOf(dialog);
    fireEvent.click(ed.getByRole('button', { name: 'Lepas gambar, Soal 1' }));
    expect(ed.getByText('Belum ada gambar. Soal hanya berisi tulisan.')).toBeInTheDocument();
    expect(ed.queryByRole('img')).toBeNull();
    expect(ed.queryByRole('button', { name: 'Lepas gambar, Soal 1' })).toBeNull();

    // Disimpan: soal itu tanpa gambar, soal lain tetap bergambar.
    await save(dialog);
    expect(savedVisual(0)).toBeUndefined();
    expect(savedVisual(1)).toBeTruthy();
  }, 40_000);

  it('soal tanpa gambar dipasangi benda hitung (apel, 3) lewat tombol Benda hitung', async () => {
    const dialog = await openBank();
    const ed = editorOf(dialog);
    fireEvent.click(ed.getByRole('button', { name: 'Lepas gambar, Soal 1' }));
    fireEvent.click(ed.getByRole('button', { name: 'Benda hitung, Soal 1' }));
    expect(ed.getByRole('img')).toHaveAttribute('aria-label', '3 apel');
    expect(ed.getByRole('button', { name: 'Benda hitung, Soal 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }, 40_000);
});

describe('dialog soal: gambar dari Galeri Aset dan Ilustrasi AI', () => {
  it('pemilih membuka kisi gambar; memilih satu memasangnya sebagai gambar utuh bernama', async () => {
    const dialog = await openBank();
    const ed = editorOf(dialog);
    fireEvent.click(ed.getByRole('button', { name: 'Pilih dari galeri, Soal 1' }));
    const picker = await screen.findByRole('dialog', { name: 'Pilih gambar untuk soal 1' });
    // Lembar sertifikat tidak ditawarkan; benda soal, sandi gambar, Momo, dan tanaman ada.
    const tabs = within(picker).getByRole('tablist', { name: 'Jenis aset' });
    expect(within(tabs).queryByRole('tab', { name: /Sertifikat/ })).toBeNull();
    for (const name of [/Benda soal/, /Sandi gambar/, /Momo/, /Tanaman/, /Ilustrasi AI/])
      expect(within(tabs).getByRole('tab', { name })).toBeInTheDocument();

    fireEvent.click(within(picker).getByRole('button', { name: 'Pasang gambar Bintang' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Pilih gambar untuk soal 1' })).toBeNull(),
    );
    // Dialog soal tetap terbuka dan kartu kini berisi gambar utuh dengan keterangan dari nama aset.
    expect(screen.getByRole('dialog', { name: /^Soal level 1:/ })).toBeInTheDocument();
    const img = ed.getByRole('img', { name: 'Bintang' }) as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(ed.getByRole('textbox', { name: 'Keterangan gambar, Soal 1' })).toHaveValue('Bintang');
    expect(ed.queryByRole('spinbutton')).toBeNull();

    fireEvent.change(ed.getByRole('textbox', { name: 'Keterangan gambar, Soal 1' }), {
      target: { value: 'Bintang kuning besar' },
    });
    expect(ed.getByRole('img', { name: 'Bintang kuning besar' })).toBeInTheDocument();
    await save(dialog);
    expect(savedVisual()).toMatchObject({ kind: 'image', label: 'Bintang kuning besar' });
    expect((savedVisual() as { url: string }).url).toMatch(/^data:image\/svg\+xml;base64,/);
  }, 40_000);

  it('Esc di pemilih hanya menutup pemilih, bukan dialog soal di belakangnya', async () => {
    const dialog = await openBank();
    fireEvent.click(editorOf(dialog).getByRole('button', { name: 'Pilih dari galeri, Soal 1' }));
    await screen.findByRole('dialog', { name: 'Pilih gambar untuk soal 1' });
    // Dialog soal digambar ulang selagi pemilih terbuka; urutan tumpukan tidak boleh berubah.
    fireEvent.change(
      dialog.querySelector('input[aria-label="Petunjuk saat belum tepat (opsional) 1"]')!,
      {
        target: { value: 'Petunjuk baru.' },
      },
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Pilih gambar untuk soal 1' })).toBeNull(),
    );
    expect(screen.getByRole('dialog', { name: /^Soal level 1:/ })).toBeInTheDocument();
  }, 40_000);

  it('ilustrasi AI yang disetujui muncul di pemilih; yang belum disetujui tidak', async () => {
    const make = (subject: string) =>
      adm<Illustration>('/admin/illustrations', 'POST', {
        kind: 'scene',
        subject,
        theme: 'outdoor',
        count: 3,
        withMomo: false,
        momoColor: 'blue',
        variant: 1,
      });
    const approved = await make('apel merah di kebun');
    await make('bola biru di kelas');
    await adm(`/admin/illustrations/${approved.id}`, 'PATCH', { status: 'approved' });

    const dialog = await openBank();
    const ed = editorOf(dialog);
    fireEvent.click(ed.getByRole('button', { name: 'Pilih dari galeri, Soal 1' }));
    const picker = await screen.findByRole('dialog', { name: 'Pilih gambar untuk soal 1' });
    fireEvent.click(await within(picker).findByRole('tab', { name: /Ilustrasi AI 1/ }));
    expect(within(picker).queryByRole('button', { name: /bola biru/ })).toBeNull();
    fireEvent.click(
      within(picker).getByRole('button', { name: 'Pasang gambar apel merah di kebun' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Pilih gambar/ })).toBeNull());
    const img = ed.getByRole('img', { name: 'apel merah di kebun' }) as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(atob(img.getAttribute('src')!.split(',')[1]!)).toContain('<svg');
  }, 40_000);
});

describe('dialog soal: unggah gambar sendiri', () => {
  const fileInput = (dialog: HTMLElement) =>
    editorOf(dialog).getByLabelText('Unggah gambar, Soal 1', { selector: 'input[type="file"]' });
  const upload = async (dialog: HTMLElement, file: File) => {
    await act(async () => {
      fireEvent.change(fileInput(dialog), { target: { files: [file] } });
    });
  };

  it('berkas yang lolos diolah menjadi gambar soal dan ikut tersimpan', async () => {
    vi.mocked(imageFile.processQuestionImage).mockResolvedValue({ ok: true, dataUrl: PNG });
    const dialog = await openBank();
    expect(fileInput(dialog)).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
    await upload(dialog, new File(['x'], 'apel.png', { type: 'image/png' }));
    const ed = editorOf(dialog);
    const img = await ed.findByRole('img', { name: 'Gambar soal' });
    expect(img).toHaveAttribute('src', PNG);
    expect(imageFile.processQuestionImage).toHaveBeenCalledOnce();
    fireEvent.change(ed.getByRole('textbox', { name: 'Keterangan gambar, Soal 1' }), {
      target: { value: 'Foto apel' },
    });
    await save(dialog);
    expect(savedVisual()).toEqual({ kind: 'image', url: PNG, label: 'Foto apel' });
  }, 40_000);

  it('berkas yang ditolak memberi pesan ramah dan gambar lama tidak berubah', async () => {
    const dialog = await openBank();
    const ed = editorOf(dialog);
    const before = ed.getByRole('img').getAttribute('aria-label');
    const process = vi.mocked(imageFile.processQuestionImage);
    const cases = [
      ['type', 'Berkas harus gambar PNG, JPG, atau WebP.'],
      ['size', 'Gambar terlalu besar. Pakai gambar paling besar 3 MB.'],
      ['read', 'Gambar tidak bisa dibaca. Coba berkas lain.'],
      ['big', 'Gambar masih terlalu besar setelah dikecilkan. Pakai gambar yang lebih sederhana.'],
    ] as const;
    for (const [problem, message] of cases) {
      process.mockResolvedValueOnce({ ok: false, problem });
      await upload(dialog, new File(['x'], 'a.png', { type: 'image/png' }));
      expect(await ed.findByRole('alert')).toHaveTextContent(message);
      expect(ed.getByRole('img').getAttribute('aria-label')).toBe(before);
    }
    // Pesan hilang begitu gambar dilepas.
    fireEvent.click(ed.getByRole('button', { name: 'Lepas gambar, Soal 1' }));
    expect(ed.queryByRole('alert')).toBeNull();
  }, 40_000);

  it('galat tak terduga saat membaca berkas juga jadi pesan ramah', async () => {
    vi.mocked(imageFile.processQuestionImage).mockRejectedValue(new Error('rusak'));
    const dialog = await openBank();
    await upload(dialog, new File(['x'], 'a.png', { type: 'image/png' }));
    expect(await editorOf(dialog).findByRole('alert')).toHaveTextContent(
      'Gambar tidak bisa dibaca. Coba berkas lain.',
    );
  }, 40_000);
});

describe('anak melihat gambar yang disunting admin', () => {
  const ayu = () =>
    useSession.setState({ session: { token: 'mock-child:c-ayu', role: 'child', name: 'Ayu' } });

  afterEach(() => {
    useSession.setState({ session: null });
  });

  it('gambar utuh (unggahan atau ilustrasi) dan benda hitung sampai ke soal anak, tanpa kunci jawaban', async () => {
    const draft = await adm<LevelQuestions>(`/admin/levels/${AUTO}/questions`);
    const items = draft.items.map((q, i) => ({
      ...q,
      visual:
        i % 2 === 0
          ? { kind: 'image' as const, url: PNG, label: `Foto ${i + 1}` }
          : { item: 'apple' as const, groups: [2, 3] },
    }));
    const books = await adm<CatalogBook[]>(`/admin/levels/${AUTO}/questions`, 'PUT', { items });
    expect(books.length).toBeGreaterThan(0);

    ayu();
    const round = await startRound(AUTO);
    expect(round.questions).toHaveLength(10);
    expect(JSON.stringify(round)).not.toMatch(/"answer"/);
    for (const q of round.questions)
      expect(q.visual?.kind === 'image' ? q.visual.url === PNG : q.visual?.item === 'apple').toBe(
        true,
      );
  });

  it('halaman ronde menampilkan foto unggahan di atas pilihan jawaban', async () => {
    const draft = await adm<LevelQuestions>(`/admin/levels/${AUTO}/questions`);
    await adm(`/admin/levels/${AUTO}/questions`, 'PUT', {
      items: draft.items.map((q) => ({
        ...q,
        visual: { kind: 'image', url: PNG, label: 'Foto buatan admin' },
      })),
    });
    ayu();
    render(
      <MemoryRouter initialEntries={[`/play/latihan/${AUTO}`]}>
        <Routes>
          <Route path="/play/latihan/:levelId" element={<RoundPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Soal 1 dari 10')).toBeInTheDocument();
    const img = await screen.findByRole('img', { name: 'Foto buatan admin' });
    expect(img).toHaveAttribute('src', PNG);
    expect(img.tagName).toBe('IMG');
  });
});
