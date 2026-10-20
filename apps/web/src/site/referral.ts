const KEY = 'udakids:referral';
const MONTH = 30 * 86_400_000;

export function rememberReferral(code: string) {
  if (!/^[A-Za-z2-9]{6}$/.test(code)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

export function readReferral() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null') as {
      code?: string;
      at?: number;
    } | null;
    if (data?.code && /^[A-Z2-9]{6}$/.test(data.code) && data.at && Date.now() - data.at < MONTH)
      return data.code;
  } catch {
    /* abaikan */
  }
  return '';
}

export function forgetReferral() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}
