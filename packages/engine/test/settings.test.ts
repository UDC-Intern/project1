import { describe, expect, it } from 'vitest';
import { FREE_LEVELS } from '../src/rules/level.js';
import { maskName, meanScore } from '../src/rules/certificate.js';
import { certificateNameInputSchema, certificateNameSchema } from '../src/schemas/api.js';
import { illustrationRequestSchema } from '../src/schemas/media.js';
import {
  DEFAULT_SETTINGS,
  adminWhatsappHref,
  billingSettingsSchema,
  certificateSettingsSchema,
  SIGNATURE_IMAGE_MAX,
  contactSettingsSchema,
  isFreeLevel,
  mergeSettings,
  voiceSettingsSchema,
  whatsappFromPhone,
} from '../src/schemas/settings.js';

describe('pengaturan akses berbayar', () => {
  it('level gratis mengikuti batas, atau semua gratis bila kunci berbayar mati', () => {
    const billing = { paywall: true, freeLevels: 3, orderExpiryHours: 24 };
    expect([1, 2, 3, 4].map((n) => isFreeLevel(n, billing))).toEqual([true, true, true, false]);
    expect(isFreeLevel(12, { ...billing, paywall: false })).toBe(true);
  });

  it('nilai awal sama dengan aturan lama dan batas di luar 1–12 ditolak', () => {
    expect(DEFAULT_SETTINGS.billing.freeLevels).toBe(FREE_LEVELS);
    expect(
      billingSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.billing, freeLevels: 0 }).success,
    ).toBe(false);
    expect(
      billingSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.billing, orderExpiryHours: 169 })
        .success,
    ).toBe(false);
  });
});

describe('pengaturan kontak WhatsApp', () => {
  it('nomor HP Indonesia menjadi link wa.me', () => {
    expect(whatsappFromPhone('0812-3456-7890')).toBe('https://wa.me/6281234567890');
    expect(whatsappFromPhone('+62 812 3456 7890')).toBe('https://wa.me/6281234567890');
    expect(whatsappFromPhone('https://wa.me/6281234567890')).toBe('https://wa.me/6281234567890');
  });

  it('hanya link WhatsApp yang diterima; grup hanya chat.whatsapp.com', () => {
    const ok = (v: Record<string, string>) =>
      contactSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.contact, ...v }).success;
    expect(ok({ adminWhatsapp: '' })).toBe(true);
    expect(ok({ adminWhatsapp: 'https://api.whatsapp.com/send?phone=62812' })).toBe(true);
    expect(ok({ adminWhatsapp: 'http://wa.me/62812' })).toBe(false);
    expect(ok({ adminWhatsapp: 'https://wa.me.contoh.com/62812' })).toBe(false);
    expect(ok({ groupWhatsapp: 'https://chat.whatsapp.com/AbC123' })).toBe(true);
    expect(ok({ groupWhatsapp: 'https://wa.me/62812' })).toBe(false);
  });

  it('pesan pembuka ditempel sebagai ?text=, menggantikan text lama', () => {
    expect(adminWhatsappHref({ adminWhatsapp: '', adminMessage: 'Halo' })).toBe('');
    expect(adminWhatsappHref({ adminWhatsapp: 'https://wa.me/62812', adminMessage: '' })).toBe(
      'https://wa.me/62812',
    );
    expect(
      adminWhatsappHref({
        adminWhatsapp: 'https://wa.me/62812?text=lama',
        adminMessage: 'Halo admin',
      }),
    ).toBe('https://wa.me/62812?text=Halo+admin');
  });
});

describe('pengaturan lembar sertifikat', () => {
  it('nilai awal lolos skema; penerbit dan penanda tangan wajib', () => {
    expect(certificateSettingsSchema.safeParse(DEFAULT_SETTINGS.certificate).success).toBe(true);
    expect(
      certificateSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.certificate, issuer: ' ' }).success,
    ).toBe(false);
    expect(
      certificateSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.certificate, signer2Name: '' })
        .success,
    ).toBe(false);
  });

  it('hanya satu penanda tangan: bagian kiri (Momo) tidak ada lagi di skema', () => {
    expect(DEFAULT_SETTINGS.certificate).not.toHaveProperty('signer1Name');
    expect(
      certificateSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS.certificate,
        signer1Name: 'Momo',
        signer1Role: 'Teman Belajar',
      }).success,
    ).toBe(false);
  });

  it('tanda tangan dan stempel: nilai awal bawaan, stempel menyala', () => {
    expect(DEFAULT_SETTINGS.certificate).toMatchObject({
      signatureType: 'default',
      signatureImage: '',
      showStamp: true,
    });
    // Pengaturan yang belum punya ketiga isian ini mendapat nilai awalnya.
    const { signatureType, signatureImage, showStamp, ...old } = DEFAULT_SETTINGS.certificate;
    void [signatureType, signatureImage, showStamp];
    expect(certificateSettingsSchema.parse(old)).toEqual(DEFAULT_SETTINGS.certificate);
  });

  it('gambar tanda tangan hanya PNG, JPG, atau WebP berbentuk Data URL dan tidak terlalu besar', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const ok = (signatureImage: string, signatureType = 'upload') =>
      certificateSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS.certificate,
        signatureType,
        signatureImage,
      }).success;
    expect(ok(png, 'draw')).toBe(true);
    expect(ok('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(ok('data:image/webp;base64,UklGRg==')).toBe(true);
    expect(ok('')).toBe(true);
    for (const bad of [
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:text/html;base64,PGh0bWw+',
      'https://contoh.id/ttd.png',
      'javascript:alert(1)',
      'data:image/png;base64,',
      'data:image/png;base64,abc def',
    ])
      expect(ok(bad)).toBe(false);
    const big = 'data:image/png;base64,' + 'A'.repeat(SIGNATURE_IMAGE_MAX);
    expect(ok(big)).toBe(false);
    expect(
      certificateSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS.certificate,
        signatureType: 'ukir',
      }).success,
    ).toBe(false);
  });
});

describe('mergeSettings', () => {
  it('pengaturan lama yang belum lengkap digabung dengan nilai awal per bagian', () => {
    const merged = mergeSettings({ billing: { freeLevels: 4 }, contact: { adminMessage: 'Halo' } });
    expect(merged.billing).toEqual({ ...DEFAULT_SETTINGS.billing, freeLevels: 4 });
    expect(merged.contact.adminMessage).toBe('Halo');
    expect(merged.certificate).toEqual(DEFAULT_SETTINGS.certificate);
  });

  it('field asing dibuang, bagian yang tidak lolos kembali ke nilai awal', () => {
    const merged = mergeSettings({
      billing: { freeLevels: 99, rahasia: true },
      certificate: { issuer: 'Sekolah Ceria', bebas: 1 },
    });
    expect(merged.billing).toEqual(DEFAULT_SETTINGS.billing);
    expect(merged.certificate.issuer).toBe('Sekolah Ceria');
    expect(merged.certificate).not.toHaveProperty('bebas');
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('pengaturan lama dengan penanda tangan kiri tetap terbaca: isian itu dibuang, sisanya dipertahankan', () => {
    const merged = mergeSettings({
      certificate: {
        issuer: 'Sekolah Ceria',
        signer1Name: 'Momo',
        signer1Role: 'Teman Belajar',
        signer2Name: 'Bu Rina',
      },
    });
    expect(merged.certificate).toMatchObject({
      issuer: 'Sekolah Ceria',
      signer2Name: 'Bu Rina',
      signatureType: 'default',
      showStamp: true,
    });
    expect(merged.certificate).not.toHaveProperty('signer1Name');
  });
});

describe('nama di sertifikat', () => {
  it('spasi dirapikan; huruf, titik, petik, dan tanda hubung boleh', () => {
    expect(certificateNameSchema.parse('  Ayu   Lestari ')).toBe('Ayu Lestari');
    for (const name of ["Siti Nur'aini", 'Muh. Rizki', 'Ayu-Lestari', 'Ni Made Ayu'])
      expect(certificateNameSchema.safeParse(name).success).toBe(true);
    for (const name of ['A', 'Ayu123', '-Ayu', 'Ayu 😀', 'x'.repeat(61)])
      expect(certificateNameSchema.safeParse(name).success).toBe(false);
  });

  it('isian formulir: kosong berarti hapus, galat tetap spesifik', () => {
    expect(certificateNameInputSchema.parse('  ')).toBe('');
    const res = certificateNameInputSchema.safeParse('Ayu123');
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.message).toMatch(/huruf/);
  });

  it('nama disamarkan untuk halaman cek keaslian', () => {
    expect(maskName('Ayu Lestari')).toBe('A** L******');
    expect(maskName(' Bima ')).toBe('B***');
    expect(maskName('Ñoño')).toBe('Ñ***');
  });

  it('rata-rata skor dibulatkan; tanpa skor null', () => {
    expect(meanScore([90, 100, 81])).toBe(90);
    expect(meanScore([])).toBeNull();
  });
});

describe('pengaturan suara narasi', () => {
  it('nilai awal sama dengan suara lama; kecepatan dan nada dibatasi', () => {
    expect(DEFAULT_SETTINGS.voice).toEqual({
      enabled: true,
      autoRead: true,
      rate: 0.92,
      pitch: 1.1,
      voiceName: '',
    });
    expect(voiceSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.voice, rate: 2 }).success).toBe(
      false,
    );
    expect(voiceSettingsSchema.safeParse({ ...DEFAULT_SETTINGS.voice, pitch: 0.2 }).success).toBe(
      false,
    );
    expect(mergeSettings({ voice: { rate: 1.2 } }).voice.rate).toBe(1.2);
  });
});

describe('permintaan ilustrasi', () => {
  const ok = {
    kind: 'scene',
    subject: 'apel merah',
    theme: 'outdoor',
    count: 5,
    withMomo: true,
    momoColor: 'blue',
    variant: 1,
  };
  it('jumlah benda 1 sampai 12 dan jenis yang dikenal', () => {
    expect(illustrationRequestSchema.safeParse(ok).success).toBe(true);
    expect(illustrationRequestSchema.safeParse({ ...ok, count: 0 }).success).toBe(false);
    expect(illustrationRequestSchema.safeParse({ ...ok, kind: 'video' }).success).toBe(false);
    expect(illustrationRequestSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
});
