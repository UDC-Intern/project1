import type { CertificateBook, CertificateVerify, ChildCertificates } from '@udakids/engine';
import { useSession } from '../auth/store';
import { request } from './client';
import * as mock from './mock/certificate';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;
const enc = encodeURIComponent;

/** Semua buku dengan kemajuan menuju sertifikat, untuk anak yang sedang masuk. */
export const myCertificates = (): Promise<ChildCertificates> =>
  isMocked('catalog') ? mock.myCertificates(token()) : request<ChildCertificates>('/certificates');

/** Kemajuan dan sertifikat satu buku. */
export const myCertificate = (bookSlug: string): Promise<CertificateBook> =>
  isMocked('catalog')
    ? mock.myCertificate(token(), bookSlug)
    : request<CertificateBook>(`/certificates/books/${enc(bookSlug)}`);

/** Cek keaslian (publik): nomor terdaftar atau 404, dengan nama anak disamarkan. */
export const verifyCertificate = (id: string): Promise<CertificateVerify> =>
  isMocked('catalog')
    ? mock.verifyCertificate(id)
    : request<CertificateVerify>(`/certificates/verify/${enc(id.trim().toUpperCase())}`);

/** Mengambil sertifikat yang tertunda (buku tuntas, Premium aktif). */
export const claimCertificate = (bookSlug: string): Promise<CertificateBook> =>
  isMocked('catalog')
    ? mock.claimCertificate(token(), bookSlug)
    : request<CertificateBook>(`/certificates/books/${enc(bookSlug)}/claim`, { method: 'POST' });
