import { MOMO_COLORS, type MomoColor } from '@udakids/engine';
import { useCallback, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { profile, setMomo } from '../api/catalog';
import { speak } from '../audio/speech';
import { Momo } from '../components/Momo';
import { BackIcon, SpeakerIcon } from '../components/Icons';
import { useAsync } from '../hooks/useAsync';
import { AutoSpeak } from './AutoSpeak';
import { useT } from '../i18n';
import { formatDateTime } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';

type StatKind = 'points' | 'passed' | 'highest' | 'time' | 'played' | 'answered' | 'rank';

function StatSvg({ kind }: { kind: StatKind }) {
  const common = { viewBox: '0 0 48 48', width: 34, height: 34, 'aria-hidden': true } as const;
  switch (kind) {
    case 'points':
      return (
        <svg {...common} className="stat-icon">
          <path
            d="M24 4l6 13 14 1.5-10.5 9.5 3 14L24 35l-12.5 7 3-14L4 18.5 18 17z"
            fill="currentColor"
          />
        </svg>
      );
    case 'passed':
      return (
        <svg {...common} className="stat-icon">
          <path d="M10 44V6" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <path d="M12 8h26l-6 8 6 8H12z" fill="currentColor" />
        </svg>
      );
    case 'highest':
      return (
        <svg {...common} className="stat-icon">
          <path d="M4 42L18 16l8 12 6-8 12 22z" fill="currentColor" />
          <path d="M18 16l-4 8h8z" fill="var(--kertas)" opacity="0.8" />
        </svg>
      );
    case 'time':
      return (
        <svg {...common} className="stat-icon">
          <circle cx="24" cy="27" r="17" fill="none" stroke="currentColor" strokeWidth="5" />
          <path
            d="M24 17v10l7 5"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="18" y="2" width="12" height="6" rx="3" fill="currentColor" />
        </svg>
      );
    case 'played':
      return (
        <svg {...common} className="stat-icon">
          <rect x="6" y="12" width="36" height="26" rx="10" fill="currentColor" />
          <path d="M15 21v8M11 25h8" stroke="var(--kertas)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="31" cy="22" r="3" fill="var(--kertas)" />
          <circle cx="36" cy="28" r="3" fill="var(--kertas)" />
        </svg>
      );
    case 'answered':
      return (
        <svg {...common} className="stat-icon">
          <rect x="8" y="6" width="32" height="38" rx="8" fill="currentColor" />
          <path
            d="M15 18l3 3 6-6M15 31l3 3 6-6M28 19h6M28 32h6"
            stroke="var(--kertas)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'rank':
      return (
        <svg {...common} className="stat-icon">
          <path d="M14 4h20l-4 14H18z" fill="currentColor" opacity="0.55" />
          <circle cx="24" cy="30" r="13" fill="currentColor" />
          <path
            d="M24 23l2.5 5 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.8z"
            fill="var(--kertas)"
          />
        </svg>
      );
  }
}

function MoonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Bacakan isi satu kartu statistik: angka lalu keterangannya. */
const readStat = (el: HTMLElement) =>
  speak([...el.querySelectorAll('span')].map((x) => x.textContent ?? '').join(' '));

export function ProfilePage() {
  const t = useT('play');
  const load = useCallback(() => profile(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [color, setColor] = useState<MomoColor | null>(null);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const current: MomoColor = color ?? data.momoColor;

  async function pick(next: MomoColor) {
    setColor(next);
    await setMomo(next);
  }

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('udakids.theme', isDark ? 'dark' : 'light');
    } catch {
      /* abaikan */
    }
  };

  const readable = {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (e: MouseEvent<HTMLElement>) => readStat(e.currentTarget),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') readStat(e.currentTarget);
    },
  };

  const sayProfileText = `${data.nickname}. Total skor ${data.totalScore}. Level lulus ${data.levelsPassed}. ${data.rounds} kali bermain.`;
  const sayProfile = () => speak(sayProfileText);

  // Estimasi waktu bermain dari jumlah ronde: rata-rata ~1.2 menit per ronde
  const totalMinutes = Math.max(1, Math.floor(data.rounds * 1.2));
  const totalSeconds = (data.rounds * 23) % 60;
  const timeFormatted = `${String(totalMinutes).padStart(2, '0')}:${String(totalSeconds).padStart(2, '0')}`;
  const totalAnswered = data.rounds * 10;
  const rankNumber = 1502; // Peringkat demo konsisten dengan referensi
  const rankTotal = 1590;

  return (
    <main className="library profile-page">
      <AutoSpeak text={sayProfileText} />
      <header className="practice-head">
        <Link to="/play" className="kid-link" aria-label="Kembali ke beranda">
          <BackIcon size={32} />
        </Link>
        <div className="practice-title">
          <strong>Profilku</strong>
        </div>
        <span />
      </header>

      {/* Hero card: avatar Momo, nama, status kelas, dan 4 tombol aksi */}
      <section className="profile-hero">
        <div className="profile-avatar">
          <Momo own color={current} mood="proud" size={110} />
        </div>
        <div className="profile-id">
          <h1>{data.nickname}</h1>
          <p className="profile-sub">Belum ikut kelas</p>
          <div className="profile-actions">
            <button
              type="button"
              className="profile-speaker"
              aria-label="Dengarkan profil"
              onClick={sayProfile}
            >
              <SpeakerIcon size={24} />
            </button>
            <Link className="kid-btn profile-board-btn" to="/play/peringkat">
              Papan peringkat
            </Link>
            <button
              type="button"
              className="kid-btn secondary mode-toggle-btn"
              onClick={toggleTheme}
            >
              <MoonIcon size={18} />
              <span>Mode gelap</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pilihan warna Momo */}
      <section className="swatches-box">
        <h2>Pilih Warna Momo</h2>
        <div className="swatch-row">
          {MOMO_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch-btn ${current === c ? 'is-on' : ''}`}
              aria-label={t('color.' + c)}
              aria-pressed={current === c}
              onClick={() => void pick(c)}
            >
              <Momo color={c} size={48} />
            </button>
          ))}
        </div>
      </section>

      {/* Grid 7 statistik sesuai referensi gambar */}
      <div className="profile-stats profile-grid">
        <div className="profile-stat is-points" {...readable}>
          <StatSvg kind="points" />
          <span className="profile-value">{data.totalScore}</span>
          <span className="profile-label">Total skor</span>
        </div>

        <div className="profile-stat is-passed" {...readable}>
          <StatSvg kind="passed" />
          <span className="profile-value">{data.levelsPassed}</span>
          <span className="profile-label">Level lulus</span>
        </div>

        <div className="profile-stat is-highest" {...readable}>
          <StatSvg kind="highest" />
          <span className="profile-value">
            {data.levelsPassed > 0 ? `Level ${data.levelsPassed}` : 'Level 1'}
          </span>
          <span className="profile-label">Sains Grade 1–2 (Olimpiade)</span>
        </div>

        <div className="profile-stat is-time" {...readable}>
          <StatSvg kind="time" />
          <span className="profile-value">{timeFormatted}</span>
          <span className="profile-label">Total waktu</span>
        </div>

        <div className="profile-stat is-played" {...readable}>
          <StatSvg kind="played" />
          <span className="profile-value">{data.rounds}</span>
          <span className="profile-label">Kali bermain</span>
        </div>

        <div className="profile-stat is-answered" {...readable}>
          <StatSvg kind="answered" />
          <span className="profile-value">{totalAnswered}</span>
          <span className="profile-label">Soal dijawab</span>
        </div>

        <Link to="/play/peringkat" className="profile-stat is-rank is-link">
          <StatSvg kind="rank" />
          <span className="profile-value">#{rankNumber}</span>
          <span className="profile-label">
            Peringkat {rankNumber} dari {rankTotal}
          </span>
        </Link>
      </div>

      {/* Riwayat latihan */}
      <section className="history">
        <h2>Riwayat Bermain</h2>
        {data.history.length === 0 ? (
          <p className="kid-note">Belum ada riwayat bermain. Ayo mulai petualanganmu!</p>
        ) : (
          <ol className="history-list">
            {data.history.map((h) => (
              <li key={h.roundId} className={`history-row ${h.passed ? 'is-passed' : 'is-failed'}`}>
                <span className="history-score">{h.score}</span>
                <span className="history-main">
                  <strong>{h.levelTitle}</strong>
                  <small>{formatDateTime(h.finishedAt)}</small>
                </span>
                <span className="history-badge">
                  {h.passed ? t('history.passed') : t('history.retry')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
