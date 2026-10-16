import { useLocation } from 'react-router-dom';
import { BILLING } from '../content/billing';
import { t } from '../i18n';
import './whatsapp.css';

/**
 * Tombol "Hubungi admin" lewat WhatsApp, melayang di kanan bawah. Tampil di landing dan area orang
 * tua; tidak tampil di area anak dan admin.
 */
export function WhatsAppButton() {
  const { pathname } = useLocation();
  const hidden =
    pathname === '/play' ||
    pathname.startsWith('/play/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/');
  if (hidden || !BILLING.adminWhatsapp) return null;
  const msg = encodeURIComponent(
    'Halo Admin UdaKids (Ridho Dwi Syahputra), saya ingin bertanya mengenai UdaKids.',
  );
  return (
    <a
      className="wa-fab"
      href={`https://wa.me/${BILLING.adminWhatsapp}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('common.whatsapp.label')}
      title={t('common.whatsapp.label')}
    >
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.6l-.4-.2-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.8C5.1 10 10 5.3 16 5.3S26.9 10 26.9 15.9 22 26.4 16 26.4zm6-7.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"
        />
      </svg>
      <span className="wa-fab-text">{t('common.whatsapp.short')}</span>
    </a>
  );
}
