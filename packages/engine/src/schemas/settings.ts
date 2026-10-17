import { z } from 'zod';
import { FREE_LEVELS } from '../rules/level.js';

/**
 * Pengaturan aplikasi yang diubah admin: akses berbayar, kontak WhatsApp, isi lembar sertifikat (menu Pengaturan),
 * dan suara narasi (menu Audio Narasi). Nilai awal ada di `DEFAULT_SETTINGS`; semua bagian aplikasi membaca dari sini,
 * bukan dari konstanta.
 */

// ---- Akses berbayar ----

export const billingSettingsSchema = z.strictObject({
  /** Mati: semua level terbuka gratis untuk semua anak. */
  paywall: z.boolean(),
  /** Level 1 sampai angka ini gratis di setiap topik. Level 1 selalu gratis. */
  freeLevels: z.number().int().min(1).max(12),
  /** Pesanan yang belum dibayar kedaluwarsa setelah sekian jam. */
  orderExpiryHours: z.number().int().min(1).max(168),
});
export type BillingSettings = z.infer<typeof billingSettingsSchema>;

/** Level gratis bila kunci berbayar mati, atau nomornya tidak melewati batas level gratis. */
export const isFreeLevel = (levelNumber: number, billing: BillingSettings): boolean =>
  !billing.paywall || levelNumber <= billing.freeLevels;

// ---- Kontak WhatsApp ----

const WA_HOSTS = new Set(['wa.me', 'api.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com']);
const GROUP_HOSTS = new Set(['chat.whatsapp.com']);

/** Nomor HP Indonesia (08…, 62…, +62…) menjadi https://wa.me/62…; selain nomor dikembalikan apa adanya. */
export function whatsappFromPhone(input: string): string {
  const raw = input.trim();
  if (!/^\+?[\d\s().-]{8,20}$/.test(raw)) return raw;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

/** Host dari URL https (tanpa global `URL`, engine tetap murni); selain https atau format aneh: undefined. */
function httpsHost(v: string): string | undefined {
  const m = /^https:\/\/([a-z0-9.-]+)(?::\d+)?(?:[/?#]|$)/i.exec(v);
  return m && !/\s/.test(v) ? m[1]!.toLowerCase() : undefined;
}

const httpsOn = (hosts: Set<string>, message: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => {
      if (v === '') return true;
      const host = httpsHost(v);
      return host !== undefined && hosts.has(host);
    }, message);

export const contactSettingsSchema = z.strictObject({
  /** Tombol "Hubungi admin" melayang di landing dan area orang tua. Kosong: tombol tidak tampil. */
  adminWhatsapp: z.preprocess(
    (v) => (typeof v === 'string' ? whatsappFromPhone(v) : v),
    httpsOn(WA_HOSTS, 'isi nomor WhatsApp (08…) atau link https://wa.me/…'),
  ),
  /** Pesan pembuka yang langsung terisi saat orang tua membuka WhatsApp. */
  adminMessage: z.string().trim().max(200),
  /** Tautan grup WhatsApp orang tua (opsional), tampil di halaman Paket. */
  groupWhatsapp: httpsOn(GROUP_HOSTS, 'isi link undangan grup https://chat.whatsapp.com/…'),
});
export type ContactSettings = z.infer<typeof contactSettingsSchema>;

/** Link tombol admin, dengan pesan pembuka bila ada (`?text=` untuk wa.me dan api.whatsapp.com). */
export function adminWhatsappHref(c: Pick<ContactSettings, 'adminWhatsapp' | 'adminMessage'>) {
  if (!c.adminWhatsapp) return '';
  if (!c.adminMessage) return c.adminWhatsapp;
  const [base, hash = ''] = c.adminWhatsapp.split('#', 2);
  const clean = base!.replace(/([?&])text=[^&]*&?/, '$1').replace(/[?&]$/, '');
  const text = encodeURIComponent(c.adminMessage).replace(/%20/g, '+');
  return `${clean}${clean.includes('?') ? '&' : '?'}text=${text}${hash ? `#${hash}` : ''}`;
}

// ---- Lembar sertifikat ----

const line = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Jenis tanda tangan di lembar: goresan bawaan, coretan di kanvas, atau foto/scan yang diunggah. */
export const SIGNATURE_TYPES = ['default', 'draw', 'upload'] as const;
export type SignatureType = (typeof SIGNATURE_TYPES)[number];

/** Panjang paling besar Data URL tanda tangan atau stempel (karakter), kira-kira 220 KB: cukup untuk PNG 700 × 240. */
export const SIGNATURE_IMAGE_MAX = 300_000;

/** Data URL gambar raster (bukan SVG, supaya tidak bisa membawa skrip atau alamat luar); kosong berarti tanpa gambar. */
export const imageDataUrlSchema = z
  .string()
  .max(SIGNATURE_IMAGE_MAX, 'Gambar terlalu besar.')
  .refine(
    (v) => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v),
    'Gambar harus berupa PNG, JPG, atau WebP.',
  );

/** Paling banyak stempel yang disimpan di riwayat stempel (yang pernah diunggah admin). */
export const STAMP_LIBRARY_MAX = 12;

/** Stempel yang pernah diunggah admin, tersimpan di riwayat supaya bisa dipakai lagi. */
export const stampSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(40),
  image: imageDataUrlSchema.refine((v) => v !== '', 'Gambar stempel wajib ada.'),
  createdAt: z.string(),
});
export type Stamp = z.infer<typeof stampSchema>;

/** `POST /admin/stamps`: simpan stempel baru ke riwayat. */
export const stampInputSchema = z.strictObject({
  name: z.string().trim().min(1, 'Beri nama stempel.').max(40, 'Nama stempel maksimal 40 huruf.'),
  image: imageDataUrlSchema.refine((v) => v !== '', 'Gambar stempel wajib ada.'),
});
export type StampInput = z.infer<typeof stampInputSchema>;

export const certificateSettingsSchema = z.strictObject({
  /** Nama penerbit di kepala lembar dan di tanda tangan tim, mis. "UdaKids". */
  issuer: line(2, 40),
  /** Kalimat kecil di kepala lembar, mis. "Belajar bersama Momo". */
  tagline: line(0, 50),
  title: line(2, 24),
  subtitle: line(0, 32),
  /** Satu-satunya penanda tangan, di kanan bawah lembar (di atas garisnya tampil tanda tangan). */
  signer2Name: line(2, 60),
  signer2Role: line(0, 40),
  /** Keterangan kurikulum di bawah judul buku, mis. "Sesuai Kurikulum Merdeka". Kosong: tidak tampil. */
  curriculum: line(0, 60),
  /** Tampilkan rata-rata skor terbaik level buku itu. */
  showScore: z.boolean(),
  /** Tampilkan kode QR menuju halaman cek keaslian. */
  showQr: z.boolean(),
  /** Pakai nama lengkap yang diisi orang tua bila ada; selain itu nama panggilan. */
  useFullName: z.boolean(),
  /** Jenis tanda tangan yang tampil. 'default': goresan bawaan; 'draw' dan 'upload': memakai `signatureImage`. */
  signatureType: z.enum(SIGNATURE_TYPES).optional().default('default'),
  /** Gambar tanda tangan (Data URL PNG, JPG, atau WebP) dari kanvas atau unggahan. Kosong: goresan bawaan. */
  signatureImage: imageDataUrlSchema.optional().default(''),
  /** Pasang stempel digital resmi (segel emas) di samping tanda tangan. */
  showStamp: z.boolean().optional().default(true),
  /** Gambar stempel sendiri (Data URL PNG, JPG, atau WebP) yang menggantikan segel emas bawaan. Kosong: segel bawaan. */
  stampImage: imageDataUrlSchema.optional().default(''),
});
export type CertificateSettings = z.infer<typeof certificateSettingsSchema>;

// ---- Suara narasi ----

export const voiceSettingsSchema = z.strictObject({
  /** Mati: area anak tidak bersuara sama sekali (teks tetap tampil). */
  enabled: z.boolean(),
  /** Halaman anak membacakan isinya begitu tampil. Mati: hanya saat tombol dengar diketuk. */
  autoRead: z.boolean(),
  /** Kecepatan bicara (1 = normal). */
  rate: z.number().min(0.6).max(1.4),
  /** Tinggi nada (1 = normal). */
  pitch: z.number().min(0.5).max(1.5),
  /** Nama suara peramban yang diutamakan; kosong berarti suara bahasa Indonesia pertama. */
  voiceName: z.string().trim().max(100),
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

// ---- Semua pengaturan ----

export const appSettingsSchema = z.strictObject({
  billing: billingSettingsSchema,
  contact: contactSettingsSchema,
  certificate: certificateSettingsSchema,
  voice: voiceSettingsSchema,
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  billing: { paywall: true, freeLevels: FREE_LEVELS, orderExpiryHours: 24 },
  contact: { adminWhatsapp: '', adminMessage: '', groupWhatsapp: '' },
  certificate: {
    issuer: 'UdaKids',
    tagline: 'Belajar bersama Momo',
    title: 'SERTIFIKAT',
    subtitle: 'JUARA DIGITAL',
    signer2Name: 'Tim UdaKids',
    signer2Role: 'Pengelola',
    curriculum: '',
    showScore: true,
    showQr: true,
    useFullName: true,
    signatureType: 'default',
    signatureImage: '',
    showStamp: true,
    stampImage: '',
  },
  voice: { enabled: true, autoRead: true, rate: 0.92, pitch: 1.1, voiceName: '' },
};

/**
 * Pengaturan tersimpan yang mungkin lebih lama (field baru belum ada) digabung dengan nilai awal, per bagian.
 * Field yang tidak dikenal dibuang; nilai yang tidak lolos skema diganti nilai awal bagian itu.
 */
export function mergeSettings(stored: unknown): AppSettings {
  const s = (stored ?? {}) as Partial<Record<keyof AppSettings, Record<string, unknown>>>;
  const part = <K extends keyof AppSettings>(key: K, schema: z.ZodType<AppSettings[K]>) => {
    const base = DEFAULT_SETTINGS[key] as Record<string, unknown>;
    const merged = Object.fromEntries(Object.keys(base).map((k) => [k, s[key]?.[k] ?? base[k]]));
    const parsed = schema.safeParse(merged);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS[key];
  };
  return {
    billing: part('billing', billingSettingsSchema),
    contact: part('contact', contactSettingsSchema),
    certificate: part('certificate', certificateSettingsSchema),
    voice: part('voice', voiceSettingsSchema),
  };
}
