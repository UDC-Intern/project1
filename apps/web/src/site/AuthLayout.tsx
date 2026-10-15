import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MomoColor } from '@udakids/engine';
import { Momo, type MomoMood } from '../components/Momo';
import { APP_NAME } from '../config/app';
import { t, useT } from '../i18n';
import { Cloud, Star } from './Decor';

export type AuthVariant = 'parent' | 'staff';

const ART: Record<AuthVariant, { color: MomoColor; mood: MomoMood; points: string[] }> = {
  parent: { color: 'green', mood: 'happy', points: ['p1', 'p2', 'p3'] },
  staff: { color: 'blue', mood: 'neutral', points: ['p1', 'p2', 'p3'] },
};

/**
 * Halaman masuk dan daftar orang dewasa: panel ilustrasi (atas di ponsel, kiri di layar lebar)
 * dan kartu formulir di tengah.
 */
export function AuthLayout({
  variant,
  title,
  text,
  children,
}: {
  variant: AuthVariant;
  title: string;
  text: string;
  children: ReactNode;
}) {
  const t = useT('site');
  const art = ART[variant];
  return (
    <div className={`auth-page auth-${variant}`}>
      <aside className="auth-art">
        <Link to="/" className="site-brand on-dark">
          <Momo mood="happy" size={40} color={art.color} />
          <span>{APP_NAME}</span>
        </Link>
        <div className="auth-hero">
          <Cloud className="float-a auth-cloud" width={110} />
          <Star className="spin auth-star" size={30} />
          <div className="auth-momo float-b">
            <Momo mood={art.mood} color={art.color} size={150} />
          </div>
          <h2>{title}</h2>
          <p>{text}</p>
          <ul className="auth-points">
            {art.points.map((p) => (
              <li key={p}>{t(`auth.${variant}.${p}`)}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-wrap">
          <div className="auth-card">{children}</div>
          <nav className="auth-links" aria-label={APP_NAME}>
            <Link to="/">{t('auth.home')}</Link>
            <Link to="/play/masuk">{t('auth.child')}</Link>
          </nav>
        </div>
      </main>
    </div>
  );
}

export function Stepper({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol
      className="stepper"
      aria-label={
        current > labels.length
          ? t('site.steps.done')
          : t('site.steps.label', { n: current, total: labels.length })
      }
    >
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'is-done' : n === current ? 'is-current' : '';
        return (
          <li key={label} className={state} aria-current={n === current ? 'step' : undefined}>
            <span className="stepper-dot">
              {n < current ? (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    d="M5 12l5 5 9-10"
                    stroke="currentColor"
                    strokeWidth="3.4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                n
              )}
            </span>
            <span className="stepper-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Wizard keluarga: isi data, kode dari email, lalu profil anak. */
export const familySteps = () => [
  t('site.steps.account'),
  t('site.steps.verify'),
  t('site.steps.child'),
];
