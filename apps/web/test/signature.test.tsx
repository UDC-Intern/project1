import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type CertificateSettings } from '@udakids/engine';
import { readDb, resetMockDb } from '../src/api/mock/db';
import { useSession } from '../src/auth/store';
import { CertificatesPage } from '../src/admin/content/CertificatesPage';
import { SignatureEditor, type SignatureValue } from '../src/admin/content/SignatureEditor';
import {
  INK_MAX_RATIO,
  INK_MIN_RATIO,
  SIGN_H,
  SIGN_W,
  brightnessOf,
  clearPaper,
  fitSize,
  inkRatio,
  judgeInk,
  padBox,
} from '../src/admin/content/signature';
import type { SignatureResult } from '../src/admin/content/signatureFile';
import {
  PALETTES,
  SEAL_RADIUS,
  SHEET_W,
  drawShapes,
  scallopPath,
  sheetShapes,
  type Shape,
  type SheetData,
} from '../src/components/certificate/sheet';

const processSignatureFile = vi.hoisted(() => vi.fn<(file: File) => Promise<SignatureResult>>());
vi.mock('../src/admin/content/signatureFile', async (original) => ({
  ...(await original<typeof import('../src/admin/content/signatureFile')>()),
  processSignatureFile,
}));

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

// ---- Piksel: pemeriksaan tinta dan pembersihan latar ----

/** Gambar RGBA seragam `w × h` berwarna `rgba`. */
const flat = (w: number, h: number, rgba: [number, number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return data;
};
const setPixel = (
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number,
  rgba: [number, number, number, number],
) => data.set(rgba, (y * w + x) * 4);
const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) =>
  data[(y * w + x) * 4 + 3]!;

describe('pemeriksaan tinta tanda tangan', () => {
  it('kecerahan memakai bobot mata: hijau paling terang, biru paling gelap', () => {
    expect(brightnessOf(255, 255, 255)).toBeCloseTo(255, 5);
    expect(brightnessOf(0, 0, 0)).toBe(0);
    expect(brightnessOf(0, 255, 0)).toBeGreaterThan(brightnessOf(255, 0, 0));
    expect(brightnessOf(255, 0, 0)).toBeGreaterThan(brightnessOf(0, 0, 255));
  });

  it('rasio tinta: hanya piksel gelap yang tidak transparan dihitung', () => {
    const w = 10;
    const data = flat(w, 10, [255, 255, 255, 255]);
    expect(inkRatio(data)).toBe(0);
    for (let x = 0; x < 5; x++) setPixel(data, w, x, 0, [10, 10, 10, 255]);
    expect(inkRatio(data)).toBeCloseTo(0.05, 5);
    // Piksel gelap yang transparan bukan tinta; piksel abu-abu terang juga bukan.
    setPixel(data, w, 9, 9, [0, 0, 0, 0]);
    setPixel(data, w, 8, 9, [200, 200, 200, 255]);
    expect(inkRatio(data)).toBeCloseTo(0.05, 5);
    expect(inkRatio(new Uint8ClampedArray())).toBe(0);
  });

  it('batas: kurang dari 0,5% kosong, lebih dari 70% terlalu padat, di antaranya wajar', () => {
    expect([INK_MIN_RATIO, INK_MAX_RATIO]).toEqual([0.005, 0.7]);
    expect(judgeInk(0)).toBe('empty');
    expect(judgeInk(0.0049)).toBe('empty');
    expect(judgeInk(0.005)).toBe('ok');
    expect(judgeInk(0.03)).toBe('ok');
    expect(judgeInk(0.7)).toBe('ok');
    expect(judgeInk(0.71)).toBe('dense');
    expect(judgeInk(0.99)).toBe('dense');
  });

  it('kertas putih kosong ditolak, foto yang hampir seluruhnya gelap ditolak, goresan tipis diterima', () => {
    const w = 100;
    const paper = flat(w, 100, [250, 248, 244, 255]);
    expect(judgeInk(inkRatio(paper))).toBe('empty');
    const dark = flat(w, 100, [30, 34, 40, 255]);
    expect(judgeInk(inkRatio(dark))).toBe('dense');
    for (let x = 10; x < 90; x++) setPixel(paper, w, x, 50, [20, 20, 60, 255]);
    expect(judgeInk(inkRatio(paper))).toBe('ok');
  });
});

describe('pembersihan latar tanda tangan', () => {
  it('piksel terang menjadi transparan, tinta tetap dan sedikit digelapkan, dan kotak tinta dikembalikan', () => {
    const w = 20;
    const h = 10;
    const data = flat(w, h, [248, 246, 240, 255]);
    setPixel(data, w, 5, 3, [20, 30, 90, 255]);
    setPixel(data, w, 12, 6, [40, 40, 40, 255]);
    const box = clearPaper(data, w, h);
    expect(box).toEqual({ x: 5, y: 3, w: 8, h: 4 });
    // Latar: alpha 0. Tinta: tetap pekat dan lebih gelap dari aslinya.
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, 19, 9)).toBe(0);
    expect(alphaAt(data, w, 5, 3)).toBe(255);
    expect(data[(3 * w + 5) * 4 + 2]!).toBeLessThan(90);
  });

  it('batas kecerahan 220: di atasnya transparan, di bawahnya tepi yang melunak', () => {
    const w = 3;
    const data = flat(w, 1, [0, 0, 0, 255]);
    setPixel(data, w, 0, 0, [221, 221, 221, 255]);
    setPixel(data, w, 1, 0, [195, 195, 195, 255]);
    setPixel(data, w, 2, 0, [100, 100, 100, 255]);
    clearPaper(data, w, 1);
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, 1, 0)).toBeGreaterThan(0);
    expect(alphaAt(data, w, 1, 0)).toBeLessThan(255);
    expect(alphaAt(data, w, 2, 0)).toBe(255);
  });

  it('piksel yang sudah transparan dianggap latar, dan gambar tanpa tinta tidak punya kotak', () => {
    const w = 4;
    const data = flat(w, 2, [0, 0, 0, 0]);
    expect(clearPaper(data, w, 2)).toBeNull();
    const white = flat(w, 2, [255, 255, 255, 255]);
    expect(clearPaper(white, w, 2)).toBeNull();
    expect(alphaAt(white, w, 1, 1)).toBe(0);
  });

  it('kotak tinta diberi ruang dan dijaga di dalam gambar; ukuran akhir muat di 700 × 240 tanpa dibesarkan', () => {
    expect(padBox({ x: 100, y: 50, w: 200, h: 60 }, 1000, 500)).toEqual({
      x: 88,
      y: 38,
      w: 224,
      h: 84,
    });
    expect(padBox({ x: 0, y: 0, w: 10, h: 10 }, 12, 12)).toEqual({ x: 0, y: 0, w: 12, h: 12 });
    expect([SIGN_W, SIGN_H]).toEqual([700, 240]);
    expect(fitSize(1400, 480)).toEqual({ w: 700, h: 240 });
    expect(fitSize(1000, 100)).toEqual({ w: 700, h: 70 });
    expect(fitSize(100, 400)).toEqual({ w: 60, h: 240 });
    expect(fitSize(300, 100)).toEqual({ w: 300, h: 100 });
  });
});

// ---- Lembar: satu tanda tangan di kanan bawah dan stempel ----

const settings = (patch: Partial<CertificateSettings> = {}): CertificateSettings => ({
  ...DEFAULT_SETTINGS.certificate,
  ...patch,
});
const sheet = (
  patch: Partial<CertificateSettings> = {},
  verifyUrl: string | null = null,
): SheetData => ({
  childName: 'Ayu Lestari',
  bookTitle: 'Matematika Kelas 1',
  levels: 40,
  topics: 10,
  design: 'klasik',
  number: 'CERT-7KQ2MX',
  issuedAt: '2026-10-01T00:00:00.000Z',
  averageScore: 92,
  settings: settings(patch),
  verifyUrl,
});
const texts = (shapes: Shape[]): string[] =>
  shapes.flatMap((s) => (s.kind === 'text' ? [s.text] : []));
const images = (shapes: Shape[]) => shapes.flatMap((s) => (s.kind === 'image' ? [s] : []));
const hasSeal = (shapes: Shape[]) => shapes.some((s) => s.kind === 'path' && s.fill === 'gold');

describe('lembar sertifikat: tanda tangan dan stempel', () => {
  it('hanya satu penanda tangan dan tidak ada Momo di sisi kiri', () => {
    const shapes = sheetShapes(sheet());
    expect(texts(shapes)).toContain('Tim UdaKids');
    expect(texts(shapes)).not.toContain('Momo');
    expect(texts(shapes)).not.toContain('Teman Belajar');
    expect(shapes.some((s) => s.kind === 'group')).toBe(false);
    // Semua teks tanda tangan dan garisnya ada di separuh kanan lembar.
    const name = shapes.find((s) => s.kind === 'text' && s.text === 'Tim UdaKids');
    expect(name && name.kind === 'text' && name.x).toBeGreaterThan(SHEET_W / 2);
  });

  it('tanpa gambar, goresan bawaan dipakai; gambar tampil di atas garis hanya bila jenisnya bukan bawaan', () => {
    const none = sheetShapes(sheet());
    expect(images(none)).toHaveLength(0);
    expect(none.some((s) => s.kind === 'path' && s.stroke === 'deep')).toBe(true);

    const drawn = sheetShapes(sheet({ signatureType: 'draw', signatureImage: PNG }));
    expect(images(drawn)).toHaveLength(1);
    expect(images(drawn)[0]).toMatchObject({ href: PNG });
    expect(images(drawn)[0]!.x).toBeGreaterThan(SHEET_W / 2);
    expect(drawn.some((s) => s.kind === 'path' && s.stroke === 'deep')).toBe(false);

    // Jenis "unggah" dengan gambar kosong: kembali ke goresan bawaan.
    const empty = sheetShapes(sheet({ signatureType: 'upload', signatureImage: '' }));
    expect(images(empty)).toHaveLength(0);
    // Jenis bawaan mengabaikan gambar yang masih tersimpan.
    expect(
      images(sheetShapes(sheet({ signatureType: 'default', signatureImage: PNG }))),
    ).toHaveLength(0);
  });

  it('stempel digital: menyala bawaan, bisa dimatikan, dan berada di samping kiri tanda tangan', () => {
    const on = sheetShapes(sheet());
    expect(hasSeal(on)).toBe(true);
    expect(texts(on)).toEqual(expect.arrayContaining(['UDAKIDS', 'JUARA']));
    const off = sheetShapes(sheet({ showStamp: false }));
    expect(hasSeal(off)).toBe(false);
    expect(texts(off)).not.toContain('JUARA');

    const body = on.find((s) => s.kind === 'path' && s.fill === 'gold')!;
    const xs = [...(body as { d: string }).d.matchAll(/[ML]([\d.]+) /g)].map((m) => Number(m[1]));
    const center = (Math.min(...xs) + Math.max(...xs)) / 2;
    const name = on.find((s) => s.kind === 'text' && s.text === 'Tim UdaKids') as { x: number };
    expect(center).toBeLessThan(name.x - SEAL_RADIUS);
    expect(center).toBeGreaterThan(SHEET_W / 2 - 60);
  });

  it('stempel memakai nama penerbit yang diatur admin dan tidak bertabrakan dengan kode QR', () => {
    const shapes = sheetShapes(
      sheet({ issuer: 'Sekolah Ceria' }, 'https://contoh.id/sertifikat/cek/CERT-7KQ2MX'),
    );
    expect(texts(shapes)).toContain('SEKOLAH CERIA');
    expect(texts(shapes)).toContain('Pindai untuk cek');
    // Segel di kiri tanda tangan, tanda tangan di kiri QR.
    const seal = shapes.find((s) => s.kind === 'path' && s.fill === 'gold') as { d: string };
    const sealRight = Math.max(...[...seal.d.matchAll(/[ML]([\d.]+) /g)].map((m) => Number(m[1])));
    const signLine = shapes.find(
      (s) => s.kind === 'path' && s.stroke === 'muted' && s.d.includes('H'),
    ) as {
      d: string;
    };
    const lineLeft = Number(/^M([\d.]+) /.exec(signLine.d)![1]);
    expect(sealRight).toBeLessThan(lineLeft + 20);
  });

  it('segel bergerigi dan palet emas ada di semua desain', () => {
    expect(scallopPath(0, 0, 10, 8, 4).match(/[ML]/g)).toHaveLength(8);
    for (const design of Object.keys(PALETTES) as (keyof typeof PALETTES)[])
      expect(PALETTES[design]).toMatchObject({ gold: '--kunyit', goldDeep: '--kunyit-tekan' });
  });

  it('kanvas: gambar tanda tangan yang sudah dimuat digambar sesuai perbandingannya, yang belum dimuat dilewati', () => {
    const drawImage = vi.fn();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage,
      set globalAlpha(_v: number) {},
    } as unknown as CanvasRenderingContext2D;
    const shape: Shape = { kind: 'image', href: PNG, x: 100, y: 500, w: 200, h: 72 };
    const loaded = { width: 400, height: 80 } as unknown as CanvasImageSource;

    drawShapes(ctx, [shape], PALETTES.klasik);
    expect(drawImage).not.toHaveBeenCalled();

    drawShapes(ctx, [shape], PALETTES.klasik, new Map([[PNG, loaded]]));
    expect(drawImage).toHaveBeenCalledTimes(1);
    // 400 × 80 muat di 200 × 72 menjadi 200 × 40, di tengah kotak.
    expect(drawImage).toHaveBeenCalledWith(loaded, 100, 516, 200, 40);
  });
});

// ---- Editor tanda tangan ----

const fakeContext = () => {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_t, prop) =>
        (...args: unknown[]) =>
          void calls.push(`${String(prop)}(${args.length})`),
      set: () => true,
    },
  );
  return { ctx, calls };
};

function Harness({
  initial = { type: 'default', image: '' },
  onValue,
}: {
  initial?: SignatureValue;
  onValue?: (v: SignatureValue) => void;
}) {
  const [value, setValue] = useState<SignatureValue>(initial);
  return (
    <SignatureEditor
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe('SignatureEditor', () => {
  let calls: string[];

  beforeEach(() => {
    const fake = fakeContext();
    calls = fake.calls;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake.ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG);
    processSignatureFile.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  const mode = (name: string) => screen.getByRole('button', { name });
  const canvas = () =>
    screen.getByRole('img', { name: 'Kanvas tanda tangan' }) as HTMLCanvasElement;
  const stroke = (el: HTMLElement) => {
    fireEvent.pointerDown(el, {
      pointerId: 1,
      clientX: 10,
      clientY: 20,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(el, {
      pointerId: 1,
      clientX: 60,
      clientY: 50,
      buttons: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(el, {
      pointerId: 1,
      clientX: 120,
      clientY: 40,
      buttons: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 120, clientY: 40, pointerType: 'mouse' });
  };

  it('tiga pilihan bentuk; bawaan dipilih lebih dulu dan tidak membawa gambar', () => {
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    const group = screen.getByRole('group', { name: 'Bentuk tanda tangan' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Goresan bawaan', 'Tulis / gambar', 'Unggah foto / scan']);
    expect(mode('Goresan bawaan')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/goresan tanda tangan bawaan/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Kanvas tanda tangan' })).toBeNull();
    expect(seen).not.toHaveBeenCalled();
  });

  it('kanvas tulis 350 × 120 di layar (digambar 700 × 240) dengan petunjuk dan tombol hapus', () => {
    render(<Harness />);
    fireEvent.click(mode('Tulis / gambar'));
    const el = canvas();
    expect([el.width, el.height]).toEqual([700, 240]);
    expect(el.style.aspectRatio.replace(/\s/g, '')).toBe('350/120');
    expect(el.closest('.sign-pad')).toHaveStyle({ maxWidth: '350px' });
    expect(screen.getByText('Goreskan tanda tangan di sini')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus goresan' })).toBeDisabled();
  });

  it('menggores mengirim PNG ke pratinjau, dan Hapus goresan mengosongkannya', () => {
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    fireEvent.click(mode('Tulis / gambar'));
    expect(seen).toHaveBeenLastCalledWith({ type: 'draw', image: '' });

    stroke(canvas());
    expect(calls).toContain('quadraticCurveTo(4)');
    expect(seen).toHaveBeenLastCalledWith({ type: 'draw', image: PNG });
    expect(screen.queryByText('Goreskan tanda tangan di sini')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Hapus goresan' }));
    expect(calls).toContain('clearRect(4)');
    expect(seen).toHaveBeenLastCalledWith({ type: 'draw', image: '' });
    expect(screen.getByRole('button', { name: 'Hapus goresan' })).toBeDisabled();
    expect(screen.getByText('Goreskan tanda tangan di sini')).toBeInTheDocument();
  });

  it('gambar tiap bentuk diingat saat berpindah pilihan', async () => {
    const seen = vi.fn();
    processSignatureFile.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,UPLOAD' });
    render(<Harness onValue={seen} />);
    fireEvent.click(mode('Tulis / gambar'));
    stroke(canvas());
    expect(seen).toHaveBeenLastCalledWith({ type: 'draw', image: PNG });

    fireEvent.click(mode('Unggah foto / scan'));
    expect(seen).toHaveBeenLastCalledWith({ type: 'upload', image: '' });
    const input = screen.getByLabelText('Berkas foto atau scan tanda tangan');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'ttd.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect(seen).toHaveBeenLastCalledWith({
        type: 'upload',
        image: 'data:image/png;base64,UPLOAD',
      }),
    );

    fireEvent.click(mode('Tulis / gambar'));
    expect(seen).toHaveBeenLastCalledWith({ type: 'draw', image: PNG });
    fireEvent.click(mode('Unggah foto / scan'));
    expect(seen).toHaveBeenLastCalledWith({
      type: 'upload',
      image: 'data:image/png;base64,UPLOAD',
    });
    fireEvent.click(mode('Goresan bawaan'));
    expect(seen).toHaveBeenLastCalledWith({ type: 'default', image: '' });
  });

  it('unggah: hasil bersih tampil dengan pratinjau, bisa diganti dan dihapus', async () => {
    const seen = vi.fn();
    processSignatureFile.mockResolvedValue({ ok: true, dataUrl: 'data:image/png;base64,UPLOAD' });
    render(<Harness initial={{ type: 'upload', image: '' }} onValue={seen} />);
    expect(screen.getByRole('button', { name: 'Pilih foto atau scan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hapus' })).toBeNull();

    const file = new File(['x'], 'ttd.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Berkas foto atau scan tanda tangan'), {
      target: { files: [file] },
    });
    expect(processSignatureFile).toHaveBeenCalledWith(file);
    const preview = await screen.findByRole('img', {
      name: 'Hasil tanda tangan setelah latar dibersihkan',
    });
    expect(preview).toHaveAttribute('src', 'data:image/png;base64,UPLOAD');
    expect(screen.getByRole('button', { name: 'Ganti foto' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    expect(seen).toHaveBeenLastCalledWith({ type: 'upload', image: '' });
    expect(screen.queryByRole('img', { name: /Hasil tanda tangan/ })).toBeNull();
  });

  it.each([
    ['empty', /tampak kosong/],
    ['dense', /terlalu gelap atau padat/],
    ['type', /harus gambar PNG, JPG, atau WebP/],
    ['size', /paling besar 5 MB/],
    ['read', /tidak bisa dibaca/],
  ] as const)(
    'unggah ditolak (%s): pesan ramah tampil dan gambar tidak berubah',
    async (problem, message) => {
      const seen = vi.fn();
      processSignatureFile.mockResolvedValue({ ok: false, problem });
      render(<Harness initial={{ type: 'upload', image: '' }} onValue={seen} />);
      fireEvent.change(screen.getByLabelText('Berkas foto atau scan tanda tangan'), {
        target: { files: [new File(['x'], 'ttd.png', { type: 'image/png' })] },
      });
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(seen).not.toHaveBeenCalled();
      expect(screen.queryByRole('img', { name: /Hasil tanda tangan/ })).toBeNull();
    },
  );
});

// ---- Dialog "Atur isi lembar" ----

describe('Atur isi lembar: tanda tangan dan stempel', () => {
  beforeEach(() => {
    resetMockDb();
    useSession.setState({ session: { token: 'mock-admin:a-demo', role: 'admin', name: 'Admin' } });
    const fake = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake.ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG);
  });
  afterEach(() => vi.restoreAllMocks());

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

  it('hanya satu penanda tangan: tidak ada isian penanda tangan kiri', async () => {
    const dialog = await openDialog();
    expect(
      within(dialog).getByRole('group', { name: 'Penanda tangan di kanan bawah' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Nama penanda tangan/)).toHaveValue('Tim UdaKids');
    expect(within(dialog).queryByLabelText(/Penanda tangan kiri/)).toBeNull();
    expect(within(dialog).queryByText(/Teman Belajar/)).toBeNull();
    expect(preview(dialog).querySelector('image')).toBeNull();
  });

  it('stempel digital: kotak centang menyalakan dan mematikan segel di pratinjau', async () => {
    const dialog = await openDialog();
    const stamp = within(dialog).getByLabelText('Pasang stempel digital resmi');
    expect(stamp).toBeChecked();
    expect(
      within(preview(dialog) as unknown as HTMLElement).getByText('JUARA'),
    ).toBeInTheDocument();
    fireEvent.click(stamp);
    expect(stamp).not.toBeChecked();
    expect(within(preview(dialog) as unknown as HTMLElement).queryByText('JUARA')).toBeNull();
  });

  it('coretan di kanvas langsung tampil di pratinjau dan tersimpan bersama pengaturan', async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tulis / gambar' }));
    const canvas = within(dialog).getByRole('img', { name: 'Kanvas tanda tangan' });
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      clientX: 5,
      clientY: 5,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: 80,
      clientY: 60,
      buttons: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 80, clientY: 60, pointerType: 'mouse' });
    expect(preview(dialog).querySelector('image')).toHaveAttribute('href', PNG);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pengaturan' }));
    expect(await screen.findByText('Pengaturan sertifikat disimpan.')).toBeInTheDocument();
    expect(readDb().settings.certificate).toMatchObject({
      signatureType: 'draw',
      signatureImage: PNG,
      showStamp: true,
    });
    expect(readDb().settings.certificate).not.toHaveProperty('signer1Name');
  });

  it('kembali ke goresan bawaan dan mematikan stempel tersimpan sebagai pilihan admin', async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tulis / gambar' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Goresan bawaan' }));
    fireEvent.click(within(dialog).getByLabelText('Pasang stempel digital resmi'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan pengaturan' }));
    expect(await screen.findByText('Pengaturan sertifikat disimpan.')).toBeInTheDocument();
    expect(readDb().settings.certificate).toMatchObject({
      signatureType: 'default',
      signatureImage: '',
      showStamp: false,
    });
    // Ringkasan "Lembar yang berlaku" ikut memuat pilihan baru.
    const facts = screen.getByText('Nama penerbit').closest('dl')!;
    expect(within(facts).getByText('Goresan bawaan')).toBeInTheDocument();
  });
});
