/** Kelas dan buku yang terakhir dipilih anak di beranda, disimpan di peramban. */
export const GRADE_KEY = 'udakids.library.grade';
export const BOOK_KEY = 'udakids.library.book';

export const remembered = (key: string) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

export const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* abaikan */
  }
};

/** Beranda berikutnya langsung membuka Peta Belajar buku ini. */
export function rememberBook(slug: string, grade: number) {
  remember(BOOK_KEY, slug);
  remember(GRADE_KEY, String(grade));
}
