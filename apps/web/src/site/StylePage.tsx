import { MOMO_COLORS, type MomoColor, type PinPicture, type Stage } from '@udakids/engine';
import { useState } from 'react';
import { BigButton } from '../components/BigButton';
import { BigCard } from '../components/BigCard';
import { CountObjects } from '../components/CountObjects';
import {
  BookIcon,
  CheckIcon,
  LockIcon,
  MenuIcon,
  SpeakerIcon,
  TrophyIcon,
  UserIcon,
} from '../components/Icons';
import { ListenButton } from '../components/ListenButton';
import { Momo } from '../components/Momo';
import { PicturePin } from '../components/PicturePin';
import { Plant } from '../components/Plant';
import { useT } from '../i18n';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';

const TOKENS: { name: string; note: string }[] = [
  { name: '--uk-bg', note: 'Latar halaman' },
  { name: '--uk-surface', note: 'Kartu dan panel' },
  { name: '--uk-text', note: 'Teks utama' },
  { name: '--uk-text-muted', note: 'Teks sekunder' },
  { name: '--uk-border', note: 'Garis dan bingkai' },
  { name: '--uk-primary', note: 'Tombol utama dan tautan' },
  { name: '--uk-primary-soft', note: 'Latar sorotan' },
  { name: '--uk-correct', note: 'Jawaban tepat' },
  { name: '--uk-correct-soft', note: 'Latar jawaban tepat' },
  { name: '--uk-retry', note: 'Jawaban belum tepat' },
  { name: '--uk-retry-soft', note: 'Latar belum tepat' },
  { name: '--uk-danger', note: 'Hapus (area dewasa saja)' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="uk-stack" style={{ marginBottom: 'var(--uk-space-8)' }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function StylePage() {
  const t = useT('site');
  const [pin, setPin] = useState<PinPicture[]>([]);
  return (
    <main
      style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--uk-space-6) var(--uk-space-4)' }}
    >
      <h1>{t('style.title')}</h1>
      <p>{t('style.intro')}</p>

      <Section title="Warna">
        <div className="uk-grid">
          {TOKENS.map((tok) => (
            <div key={tok.name}>
              <div className="uk-swatch" style={{ background: `var(${tok.name})` }} />
              <code>{tok.name}</code>
              <div style={{ fontSize: 'var(--uk-text-adult-sm)' }}>{tok.note}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografi">
        <p style={{ fontFamily: 'var(--uk-font-title)', fontSize: 40, margin: 0 }}>
          Judul memakai Baloo 2
        </p>
        <p style={{ fontSize: 'var(--uk-text-child)', margin: 0 }}>
          Isi area anak memakai Andika, 22 px, mudah dibaca pemula.
        </p>
        <p style={{ fontSize: 'var(--uk-text-question)', margin: 0 }}>
          Soal berukuran 30 px: berapa 3 + 2?
        </p>
        <p style={{ margin: 0 }}>Isi area dewasa memakai Andika, 16 px.</p>
      </Section>

      <Section title="Tombol">
        <div className="uk-row">
          <button type="button" className="uk-btn">
            Tombol dewasa
          </button>
          <button type="button" className="uk-btn uk-btn--ghost">
            Tombol lembut
          </button>
          <button type="button" className="uk-btn uk-btn--danger">
            Hapus
          </button>
        </div>
        <div className="uk-row">
          <BigButton>Tombol anak</BigButton>
          <BigButton variant="ghost">Tombol anak lembut</BigButton>
          <ListenButton />
        </div>
      </Section>

      <Section title="Momo (6 warna, 3 ekspresi)">
        <div className="uk-row">
          {MOMO_COLORS.map((c: MomoColor) => (
            <Momo key={c} color={c} />
          ))}
        </div>
        <div className="uk-row">
          <Momo mood="neutral" />
          <Momo mood="happy" />
          <Momo mood="encourage" />
        </div>
      </Section>

      <Section title="Tanaman (4 tahap)">
        <div className="uk-row">
          {([0, 1, 2, 3] as Stage[]).map((s) => (
            <Plant key={s} stage={s} />
          ))}
        </div>
      </Section>

      <Section title="Sandi gambar">
        <PicturePin value={pin} onChange={setPin} />
      </Section>

      <Section title="Hitung objek">
        <CountObjects visual={{ item: 'apple', groups: [3, 2] }} />
        <CountObjects visual={{ item: 'star', count: 7 }} />
      </Section>

      <Section title="Umpan balik jawaban">
        <div className="uk-feedback uk-feedback--correct">
          <CheckIcon /> Tepat! Kamu teliti menghitung.
        </div>
        <div className="uk-feedback uk-feedback--retry">
          Belum tepat. Hitung lagi dari satu, ya.
        </div>
      </Section>

      <Section title="Kartu">
        <div className="uk-grid">
          <BigCard>Kartu biasa</BigCard>
          <BigCard onClick={() => undefined}>Kartu bisa diketuk</BigCard>
          <BigCard disabled onClick={() => undefined}>
            <LockIcon /> Minta orang tua membuka level ini
          </BigCard>
        </div>
      </Section>

      <Section title="Ikon">
        <div className="uk-row">
          <BookIcon /> <TrophyIcon /> <UserIcon /> <SpeakerIcon /> <MenuIcon /> <CheckIcon />{' '}
          <LockIcon />
        </div>
      </Section>

      <Section title="Keadaan halaman">
        <LoadingState />
        <EmptyState />
        <ErrorState onRetry={() => undefined} />
      </Section>
    </main>
  );
}
