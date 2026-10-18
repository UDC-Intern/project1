import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import {
  PATH_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  HTTP_CODE_METADATA,
} from '@nestjs/common/constants';
import { AppModule } from '../src/app.module.js';
import { contentDir } from '../src/common/config.js';
type ControllerType = { prototype: object };
async function main() {
  const controllers = Reflect.getMetadata(
    MODULE_METADATA.CONTROLLERS,
    AppModule,
  ) as ControllerType[];
  // AuthModule mendaftarkan controller sendiri.
  const { AuthController } = await import('../src/auth/auth.controller.js');
  controllers.push(AuthController);
  const rows: string[] = [];
  for (const controller of controllers) {
    const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string;
    for (const key of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = Object.getOwnPropertyDescriptor(controller.prototype, key)?.value as
        object | undefined;
      if (!handler) continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;
      const paths = Reflect.getMetadata(PATH_METADATA, handler) as string | string[];
      const publicRoute =
        Reflect.getMetadata('public', handler) ?? Reflect.getMetadata('public', controller);
      const roles =
        Reflect.getMetadata('roles', handler) ?? Reflect.getMetadata('roles', controller);
      const access = publicRoute
        ? 'publik'
        : ((roles as string[] | undefined)?.join(', ') ?? 'semua sesi');
      const status =
        Reflect.getMetadata(HTTP_CODE_METADATA, handler) ??
        (method === RequestMethod.POST ? 201 : 200);
      for (const path of Array.isArray(paths) ? paths : [paths]) {
        const url = '/api/' + [prefix, path].join('/').split('/').filter(Boolean).join('/');
        rows.push(`| ${RequestMethod[method]} | \`${url}\` | ${access} | ${status} |`);
      }
    }
  }
  const header = `# Kontrak API UdaKids

Daftar rute berikut diambil dari metadata controller yang diimplementasikan. Perbarui dengan
\`pnpm --filter @udakids/api exec tsx --conditions=source scripts/document-api.ts\`.

## Konvensi

Web mengakses awalan \`/api\`; Vite dan Nginx membuang awalan tersebut. Controller tidak memasang awalan API.
JSON memakai camelCase, tanggal ISO 8601, dan durasi milidetik. Token dikirim melalui \`Authorization: Bearer ...\`.
Permintaan tanpa sesi mendapat 401, peran lain 403, dan data keluarga lain 404.

Kontrak Zod berada di [schemas](../../packages/engine/src/schemas/api.ts),
[billing](../../packages/engine/src/schemas/billing.ts), [settings](../../packages/engine/src/schemas/settings.ts),
dan [media](../../packages/engine/src/schemas/media.ts). Tipe halaman admin berada di
[view/admin.ts](../../packages/engine/src/view/admin.ts). Controller dan service tidak mengimpor frontend.

Galat berbentuk \`{ error: { code, message, ... }, message, statusCode, issues? }\`.
Isu validasi berbentuk \`{ path, message }\` tanpa mengulang nilai isian. Kode yang digunakan:
VALIDATION (400/413/415), UNAUTHENTICATED/INVALID_CREDENTIALS/WRONG_PIN (401),
FORBIDDEN/LEVEL_LOCKED/PREMIUM_REQUIRED (403), NOT_FOUND (404),
CONFLICT/NOT_ENOUGH_QUESTIONS (409), TEMPORARILY_LOCKED (423), RATE_LIMITED (429).
Kegagalan database/penyedia memberi 503 dengan pesan umum. Rute health tetap 200 dan melaporkan \`db: false\`.

## Kompatibilitas halaman

- Rute pembayaran \`/parent/*\` dan \`/billing/*\` memakai service sama. Respons pesanan memuat field kontrak
  serta \`packageSnapshot\`, \`methodSnapshot\`, \`amount\`, \`priceNormal\`, \`note\`, dan \`proofMime\` untuk halaman.
  Daftar tidak memuat isi bukti. GET bukti orang tua mengembalikan biner; admin menerima \`{dataUrl}\`.
- Unggah \`PUT /parent/orders/:id/proof\` memakai JPEG/PNG/WebP mentah maksimal 3 MB.
  Varian \`POST /billing/orders/:id/proof\` menerima UploadProofBody JSON. MIME dan isi harus sesuai.
- Akun mendukung \`/parent/account/password\` dengan \`password\` serta \`/parent/password\` dengan \`newPassword\`.
  Penggantian kata sandi mengembalikan sesi baru dan membatalkan sesi lama.
- Overview orang tua memuat \`familyCode\`, \`week\`, statistik anak dan \`plan/insights\` yang dibaca halaman.
- Katalog admin tersedia di \`/admin/catalog\` (objek books) dan \`/admin/catalogs\` (daftar buku halaman).
- Register langsung mengembalikan AuthResult ketika EMAIL_VERIFICATION=off (bawaan).
  Backend juga menyediakan verify/resend; mengaktifkan flag memerlukan UI kode verifikasi.
- Anak menerima sepuluh pertanyaan tanpa answer/explanation. Answer dilakukan berurutan dan hanya sekali.
  Finish belum lengkap mendapat 409; finish berulang mengembalikan hasil tersimpan yang sama.
- Claim sertifikat anak mengembalikan CertificateBook, claim orang tua dan penerbitan admin mengembalikan Certificate.
- Ilustrasi memiliki imageUrl opsional; URL review memerlukan token staf, URL publik hanya approved.
- GET/POST/DELETE \`/admin/demo-data\` hanya tersedia di mode mock; tidak dibuat pada server.

## Rute yang tersedia

Status sukses adalah bawaan controller; respons biner memakai Content-Type sesuai data tersimpan.

| Metode | URL dari web | Akses | Sukses |
| --- | --- | --- | --- |
`;
  await writeFile(
    join(contentDir(), '../docs/api/api.md'),
    header + rows.sort().join('\n') + '\n',
    'utf8',
  );
  console.log(`Kontrak diperbarui: ${rows.length} rute.`);
}
void main();
