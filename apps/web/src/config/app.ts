// Nama produk dan maskot ditulis di sini saja (PRD bagian 1).
export const APP_NAME = 'UdaKids';
export const CHARACTER_NAME = 'Momo';

/** Alamat API. Kosong berarti "/api" (proxy Vite di dev, Nginx di produksi). */
export const API_URL: string = import.meta.env.VITE_API_URL || '/api';

/** Modul yang masih memakai data tiruan: "*" untuk semua, atau daftar dipisah koma. */
export const MOCK_MODULES: string = import.meta.env.VITE_MOCK_MODULES ?? '*';
