export const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export type Mail = { subject: string; html: string; text: string };
export function template(subject: string, text: string): Mail {
  const brand = process.env.MAIL_BRAND ?? 'UdaKids';
  return {
    subject,
    text,
    html: `<!doctype html><html lang="id"><body style="margin:0;background:#f5f7f4;font-family:Arial,sans-serif;color:#23302b"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px"><table role="presentation" width="100%" style="max-width:600px;background:white"><tr><td style="padding:24px"><h1>${esc(brand)}</h1><h2>${esc(subject)}</h2><p style="white-space:pre-line">${esc(text)}</p><p>Ada pertanyaan? Balas email ini.</p></td></tr></table></td></tr></table></body></html>`,
  };
}
