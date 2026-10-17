import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  STAMP_LIBRARY_MAX,
  certificateSettingsSchema,
  stampInputSchema,
  type CertificateSettings,
  type Stamp,
} from '@udakids/engine';
import { CertificatesPage } from '../src/admin/content/CertificatesPage';
import { stampNameOf } from '../src/admin/content/StampPicker';
import { hasTransparency, visibleShare, type StampResult } from '../src/admin/content/stampFile';
import { ApiError } from '../src/api/client';
import { handle } from '../src/api/mock/adminRoutes';
import { readDb, resetMockDb } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';
import {
  SHEET_W,
  STAMP_BOX,
  sheetShapes,
  type SheetData,
} from '../src/components/certificate/sheet';

const processStampFile = vi.hoisted(() => vi.fn<(file: File) => Promise<StampResult>>());
vi.mock('../src/admin/content/stampFile', async (original) => ({
  ...(await original<typeof import('../src/admin/content/stampFile')>()),
  processStampFile,
}));

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

const img = (tag: string) => `data:image/png;base64,${tag}AAAA`;

beforeEach(() => {
  resetMockDb();
  useSession.setState({ session: { token: ADMIN, role: 'admin', name: 'Admin' } });
  processStampFile.mockReset();
});

describe('skema stempel', () => {
  it('pengaturan lembar menerima gambar stempel PNG, JPG, atau WebP dan menolak yang lain', () => {
    const ok = (stampImage: string) =>
      certificateSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.certificate, stampImage }).success;
    expect(DEFAULT_SETTINGS.certificate.stampImage).toBe('');
    expect(ok('')).toBe(true);
    expect(ok('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(ok('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(ok('data:image/webp;base64,UklGRg==')).toBe(true);
    expect(ok('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(ok('https://contoh.id/stempel.png')).toBe(false);
    expect(ok(`data:image/png;base64,${'A'.repeat(300_000)}`)).toBe(false);
  });

  it('masukan riwayat: nama 1 sampai 40 huruf dan gambar wajib', () => {
    expect(stampInputSchema.safeParse({ name: 'Stempel Sekolah', image: img('a') }).success).toBe(
      true,
    );
    expect(stampInputSchema.safeParse({ name: ' ', image: img('a') }).success).toBe(false);
    expect(stampInputSchema.safeParse({ name: 'x'.repeat(41), image: img('a') }).success).toBe(
      false,
    );
    expect(stampInputSchema.safeParse({ name: 'Stempel', image: '' }).success).toBe(false);
    expect(stampInputSchema.safeParse({ name: 'Stempel', image: img('a'), extra: 1 }).success).toBe(
      false,
    );
  });
});

describe('riwayat stempel (API tiruan)', () => {
  it('kosong lebih dulu; stempel baru masuk di depan dan bertahan di data tersimpan', async () => {
    expect(await adm<Stamp[]>('/admin/stamps')).toEqual([]);
    await adm('/admin/stamps', 'POST', { name: 'Stempel Lama', image: img('a') });
    const list = await adm<Stamp[]>('/admin/stamps', 'POST', {
      name: 'Stempel Baru',
      image: img('b'),
    });
    expect(list.map((s) => s.name)).toEqual(['Stempel Baru', 'Stempel Lama']);
    expect(list[0]).toMatchObject({ image: img('b') });
    expect(list[0]!.id).toMatch(/^stamp-/);
    // Sesi berikutnya (data dibaca ulang dari penyimpanan) tetap melihatnya.
    expect(readDb().stamps?.map((s) => s.name)).toEqual(['Stempel Baru', 'Stempel Lama']);
  });

  it('gambar yang sama tidak disimpan dua kali: yang lama dipindah ke depan dengan nama baru', async () => {
    const first = await adm<Stamp[]>('/admin/stamps', 'POST', { name: 'Satu', image: img('a') });
    await adm('/admin/stamps', 'POST', { name: 'Dua', image: img('b') });
    const again = await adm<Stamp[]>('/admin/stamps', 'POST', {
      name: 'Satu (baru)',
      image: img('a'),
    });
    expect(again.map((s) => s.name)).toEqual(['Satu (baru)', 'Dua']);
    expect(again[0]!.id).toBe(first[0]!.id);
  });

  it('riwayat penuh menolak yang baru, tetapi gambar yang sudah ada tetap boleh; hapus membuat ruang', async () => {
    for (let i = 0; i < STAMP_LIBRARY_MAX; i++)
      await adm('/admin/stamps', 'POST', { name: `Stempel ${i}`, image: img(`n${i}`) });
    const full = await errorOf(
      adm('/admin/stamps', 'POST', { name: 'Kelebihan', image: img('zz') }),
    );
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/penuh/);
    await adm('/admin/stamps', 'POST', { name: 'Nama baru', image: img('n3') });
    const list = await adm<Stamp[]>('/admin/stamps');
    expect(list).toHaveLength(STAMP_LIBRARY_MAX);
    const left = await adm<Stamp[]>(`/admin/stamps/${list[5]!.id}`, 'DELETE');
    expect(left).toHaveLength(STAMP_LIBRARY_MAX - 1);
    await adm('/admin/stamps', 'POST', { name: 'Kelebihan', image: img('zz') });
  });

  it('isian keliru ditolak per isian, hapus yang tidak ada 404, dan tanpa token 401', async () => {
    const bad = await errorOf(adm('/admin/stamps', 'POST', { name: '', image: 'bukan-gambar' }));
    expect(bad.status).toBe(400);
    expect(bad.issues.map((i) => i.path).sort()).toEqual(['image', 'name']);
    expect((await errorOf(adm('/admin/stamps/tidak-ada', 'DELETE'))).status).toBe(404);
    expect((await errorOf(handle('/admin/stamps', 'GET', undefined, null))).status).toBe(401);
  });
});

describe('stempel di lembar', () => {
  const sheet = (patch: Partial<CertificateSettings> = {}): SheetData => ({
    childName: 'Ayu Lestari',
    bookTitle: 'Matematika Kelas 1',
    levels: 40,
    topics: 10,
    design: 'klasik',
    number: 'CERT-7KQ2MX',
    issuedAt: '2026-10-01T00:00:00.000Z',
    averageScore: 92,
    settings: { ...DEFAULT_SETTINGS.certificate, ...patch },
    verifyUrl: null,
  });
  const images = (patch: Partial<CertificateSettings>) =>
    sheetShapes(sheet(patch)).flatMap((s) => (s.kind === 'image' ? [s] : []));

  it('tanpa gambar sendiri memakai segel emas bawaan; dengan gambar, gambar itu yang tampil di tempat segel', () => {
    const builtin = sheetShapes(sheet());
    expect(builtin.some((s) => s.kind === 'path' && s.fill === 'gold')).toBe(true);
    expect(images({})).toHaveLength(0);

    const own = sheetShapes(sheet({ stampImage: img('s') }));
    expect(own.some((s) => s.kind === 'path' && s.fill === 'gold')).toBe(false);
    const [stamp] = images({ stampImage: img('s') });
    expect(stamp).toMatchObject({ href: img('s'), w: STAMP_BOX, h: STAMP_BOX });
    // Di samping kiri tanda tangan: seluruhnya di separuh kanan lembar, tidak menimpa tanda tangan.
    const both = images({ stampImage: img('s'), signatureType: 'draw', signatureImage: img('t') });
    expect(both).toHaveLength(2);
    const signature = both.find((i) => i.href === img('t'))!;
    const placed = both.find((i) => i.href === img('s'))!;
    expect(placed.x + placed.w).toBeLessThanOrEqual(signature.x + 20);
    expect(placed.x).toBeGreaterThan(SHEET_W / 2 - 100);
  });

  it('stempel dimatikan: tidak ada segel maupun gambar stempel, walau gambar masih tersimpan', () => {
    const off = sheetShapes(sheet({ showStamp: false, stampImage: img('s') }));
    expect(off.some((s) => s.kind === 'image')).toBe(false);
    expect(off.some((s) => s.kind === 'path' && s.fill === 'gold')).toBe(false);
  });
});

describe('pemeriksaan gambar stempel', () => {
  const rgba = (px: [number, number, number, number][]) => new Uint8ClampedArray(px.flat());

  it('bagian piksel terlihat: transparan dan putih polos tidak dihitung', () => {
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const none: [number, number, number, number] = [0, 0, 0, 0];
    const red: [number, number, number, number] = [200, 30, 30, 255];
    expect(visibleShare(rgba([white, white, none, none]))).toBe(0);
    expect(visibleShare(rgba([white, red, none, red]))).toBe(0.5);
    expect(visibleShare(new Uint8ClampedArray())).toBe(0);
  });

  it('transparansi dikenali, dan nama stempel diturunkan dari nama berkas', () => {
    expect(
      hasTransparency(
        rgba([
          [1, 2, 3, 255],
          [1, 2, 3, 255],
        ]),
      ),
    ).toBe(false);
    expect(
      hasTransparency(
        rgba([
          [1, 2, 3, 255],
          [1, 2, 3, 0],
        ]),
      ),
    ).toBe(true);
    expect(stampNameOf('stempel_sekolah-ceria.PNG')).toBe('stempel sekolah ceria');
    expect(stampNameOf('x'.repeat(60) + '.jpg')).toHaveLength(40);
    expect(stampNameOf('.png')).toBe('');
  });
});

// ---- Dialog "Atur isi lembar" ----

describe('Atur isi lembar: sumber stempel', () => {
  const openDialog = async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>,
    );
    const [button] = await screen.findAllByRole('button', { name: /Atur isi lembar/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button!);
    return screen.findByRole('dialog', { name: 'Atur isi lembar sertifikat' });
  };
  const preview = (dialog: HTMLElement) =>
    dialog.querySelector('.adm-cert-preview svg') as SVGElement;
  const upload = (dialog: HTMLElement, name = 'stempel-sekolah.png') =>
    fireEvent.change(within(dialog).getByLabelText('Berkas gambar stempel'), {
      target: { files: [new File(['x'], name, { type: 'image/png' })] },
    });

  it('pilihan sumber muncul hanya bila stempel dipasang; bawaan terpilih lebih dulu', async () => {
    const dialog = await openDialog();
    const group = within(dialog).getByRole('group', { name: 'Sumber stempel' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Gunakan stempel yang sudah ada', 'Unggah stempel baru']);
    expect(
      within(group).getByRole('button', { name: 'Gunakan stempel yang sudah ada' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('combobox', { name: 'Stempel' })).toHaveTextContent(
      'Segel Emas Resmi UdaKids (bawaan)',
    );

    fireEvent.click(within(dialog).getByLabelText('Pasang stempel digital resmi'));
    expect(within(dialog).queryByRole('group', { name: 'Sumber stempel' })).toBeNull();
    fireEvent.click(within(dialog).getByLabelText('Pasang stempel digital resmi'));
    expect(within(dialog).getByRole('group', { name: 'Sumber stempel' })).toBeInTheDocument();
  });

  it('unggah stempel baru: pratinjau lembar langsung memakainya, dan masuk riwayat saat disimpan', async () => {
    processStampFile.mockResolvedValue({ ok: true, dataUrl: img('baru') });
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unggah stempel baru' }));
    upload(dialog);
    await waitFor(() => expect(preview(dialog).querySelector('image')).not.toBeNull());
    expect(preview(dialog).querySelector('image')).toHaveAttribute('href', img('baru'));
    expect(within(dialog).getByLabelText('Nama stempel')).toHaveValue('stempel sekolah');
    // Belum disimpan: riwayat masih kosong.
    expect(readDb().stamps ?? []).toEqual([]);

    fireEvent.change(within(dialog).getByLabelText('Nama stempel'), {
      target: { value: 'Stempel Sekolah Ceria' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pengaturan' }));
    expect(await screen.findByText('Pengaturan sertifikat disimpan.')).toBeInTheDocument();
    expect(readDb().settings.certificate).toMatchObject({
      showStamp: true,
      stampImage: img('baru'),
    });
    expect(readDb().stamps).toEqual([
      expect.objectContaining({ name: 'Stempel Sekolah Ceria', image: img('baru') }),
    ]);
    // Ringkasan di halaman menyebut stempel unggahan.
    const facts = screen.getByText('Nama penerbit').closest('dl')!;
    expect(within(facts).getByText('Gambar stempel unggahan')).toBeInTheDocument();
  });

  it('batal tidak menyimpan stempel ke riwayat; berkas yang ditolak memberi pesan dan tidak mengubah apa pun', async () => {
    processStampFile.mockResolvedValueOnce({ ok: false, problem: 'empty' });
    processStampFile.mockResolvedValueOnce({ ok: true, dataUrl: img('x') });
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unggah stempel baru' }));
    upload(dialog);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/tampak kosong/);
    expect(preview(dialog).querySelector('image')).toBeNull();

    upload(dialog);
    await waitFor(() => expect(preview(dialog).querySelector('image')).not.toBeNull());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readDb().stamps ?? []).toEqual([]);
    expect(readDb().settings.certificate.stampImage).toBe('');
  });

  it('sesi berikutnya: stempel yang pernah diunggah ada di pilihan, dan memilihnya memakainya di lembar', async () => {
    await adm('/admin/stamps', 'POST', { name: 'Stempel Dinas', image: img('dinas') });
    await adm('/admin/stamps', 'POST', { name: 'Stempel Sekolah', image: img('sekolah') });
    const dialog = await openDialog();
    const pick = within(dialog).getByRole('combobox', { name: 'Stempel' });
    await waitFor(() => fireEvent.click(pick));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Segel Emas Resmi UdaKids (bawaan)',
      'Stempel Sekolah',
      'Stempel Dinas',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Stempel Dinas' }));
    expect(preview(dialog).querySelector('image')).toHaveAttribute('href', img('dinas'));
    expect(within(dialog).getByRole('img', { name: 'Stempel yang dipilih' })).toHaveAttribute(
      'src',
      img('dinas'),
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pengaturan' }));
    expect(await screen.findByText('Pengaturan sertifikat disimpan.')).toBeInTheDocument();
    expect(readDb().settings.certificate.stampImage).toBe(img('dinas'));
    // Pilihan tanpa unggahan baru tidak menambah riwayat.
    expect(readDb().stamps).toHaveLength(2);
  });

  it('kembali ke segel bawaan, dan stempel bisa dihapus dari riwayat', async () => {
    await adm('/admin/stamps', 'POST', { name: 'Stempel Dinas', image: img('dinas') });
    const dialog = await openDialog();
    await waitFor(() => fireEvent.click(within(dialog).getByRole('combobox', { name: 'Stempel' })));
    fireEvent.click(await screen.findByRole('option', { name: 'Stempel Dinas' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus dari riwayat' }));
    expect(await within(dialog).findByText('Stempel dihapus dari riwayat.')).toBeInTheDocument();
    expect(readDb().stamps).toEqual([]);
    // Gambarnya masih dipakai lembar sampai admin memilih yang lain.
    expect(within(dialog).getByRole('combobox', { name: 'Stempel' })).toHaveTextContent(
      'Stempel yang sedang dipakai',
    );
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Stempel' }));
    fireEvent.click(screen.getByRole('option', { name: 'Segel Emas Resmi UdaKids (bawaan)' }));
    expect(preview(dialog).querySelector('image')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pengaturan' }));
    expect(await screen.findByText('Pengaturan sertifikat disimpan.')).toBeInTheDocument();
    expect(readDb().settings.certificate.stampImage).toBe('');
  });
});
