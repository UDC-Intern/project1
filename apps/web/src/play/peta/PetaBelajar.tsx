import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { speak } from '../../audio/speech';
import { LockIcon, MedalIcon, TrophyIcon } from '../../components/Icons';
import { Momo } from '../../components/Momo';
import { t } from '../../i18n';
import { mapelOfSlug } from '../../lib/mapel';
import { RebungBand } from '../../site/Decor';
import { SpeakButton } from '../SpeakButton';
import { PetaPanel } from './PetaPanel';
import type { PetaBook, PlayStatus, Shelf } from './types';

/**
 * Peta Belajar: jalur ular untuk topik sebuah buku (baris bolak-balik, 3 sampai 5 simpul per baris), dengan panel
 * topik di kanan (layar lebar) atau di bawah baris yang diketuk (ponsel). Semua isi dari data yang sudah ada:
 * topik, level, dan kemajuan anak.
 */

/** Tinggi satu baris peta (px): tanda + cincin 76 px + bintang + nama topik (maks 2 baris). */
export const ROW = 182;
/** Lebar minimum satu sel simpul (px); menentukan jumlah kolom 3 sampai 5. */
const CELL = 120;

/** Jumlah kolom dari lebar peta: minimal 3 (ponsel), maksimal 5. */
export const columnsFor = (width: number) =>
  Math.max(3, Math.min(5, Math.floor((width - 36) / CELL)));

/**
 * Letak simpul ke-i pada jalur ular: baris genap kiri ke kanan, baris ganjil kanan ke kiri, sehingga simpul
 * terakhir sebuah baris tepat di atas simpul pertama baris berikutnya.
 */
export function snake(i: number, cols: number) {
  const row = Math.floor(i / cols);
  const pos = i % cols;
  return { row, col: row % 2 === 0 ? pos : cols - 1 - pos };
}

export type NodeState = 'lulus' | 'sekarang' | 'terbuka' | 'terkunci';
/** Tanda tambahan simpul: topik berikutnya setelah "sekarang", atau topik terbuka lain yang boleh dilompati. */
export type NodeMark = 'berikutnya' | 'lompat';

export type NodeInfo = {
  state: NodeState;
  passed: number;
  total: number;
  /** 0 sampai 3, dari bagian level yang lulus. */
  stars: number;
  /** Level berikutnya berbayar: panel memberi tahu dengan lembut, tanpa harga. */
  paidNext: boolean;
  mark?: NodeMark;
};

/** Keadaan simpul dari kemajuan yang sudah ada. */
export function nodeInfo(
  shelf: Shelf,
  statuses: Readonly<Record<string, PlayStatus>>,
  isNext: boolean,
): NodeInfo {
  const total = shelf.skills.length;
  const st = shelf.skills.map((k) => statuses[k.id] ?? 'locked');
  const passed = st.filter((s) => s === 'passed').length;
  const done = total > 0 && passed === total;
  const closed = st.every((s) => s === 'locked' || s === 'paid');
  const stars = done ? 3 : total > 0 ? Math.min(2, Math.floor((passed / total) * 3)) : 0;
  const state: NodeState = done ? 'lulus' : closed ? 'terkunci' : isNext ? 'sekarang' : 'terbuka';
  return {
    state,
    passed,
    total,
    stars,
    paidNext: !st.includes('open') && st.includes('paid'),
  };
}

/**
 * Tanda "berikutnya" untuk topik terbuka pertama sesudah topik "sekarang", dan "boleh lompat" untuk topik
 * terbuka lainnya: anak boleh memilih topik terbuka mana saja.
 */
export function markNodes(order: NodeInfo[]): void {
  const now = order.findIndex((n) => n.state === 'sekarang');
  let nextGiven = false;
  order.forEach((n, i) => {
    if (n.state !== 'terbuka') return;
    if (now >= 0 && i > now && !nextGiven) {
      n.mark = 'berikutnya';
      nextGiven = true;
    } else n.mark = 'lompat';
  });
}

/** Panel di kanan bila layar minimal 861 px; di ponsel panel tampil di bawah baris simpul yang diketuk. */
function useWide() {
  const query = '(min-width: 861px)';
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return wide;
}

/** Jumlah kolom jalur mengikuti lebar wadah peta, bukan lebar layar. */
function useColumns() {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      if (e && e.contentRect.width > 0) setCols(columnsFor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, cols] as const;
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function PetaBelajar({
  book,
  shelves,
  statuses,
  nextCode,
  premium,
  momoColor,
}: {
  book: PetaBook;
  shelves: Shelf[];
  statuses: Readonly<Record<string, PlayStatus>>;
  /** Kode topik yang disarankan (level terbuka pertama). */
  nextCode?: string | undefined;
  /** Anak sudah punya paket? Dipakai panel untuk menyapa dengan lembut tanpa harga. */
  premium: boolean;
  momoColor: string;
}) {
  const wide = useWide();
  const [babsRef, cols] = useColumns();
  const infos = new Map(shelves.map((s) => [s.code, nodeInfo(s, statuses, s.code === nextCode)]));
  markNodes(shelves.map((s) => infos.get(s.code)!));
  const doneCount = shelves.filter((s) => infos.get(s.code)?.state === 'lulus').length;
  const allDone = shelves.length > 0 && doneCount === shelves.length;
  const levels = shelves.flatMap((s) => s.skills);
  const cert = (
    <CertLink
      slug={book.slug}
      passed={levels.filter((k) => statuses[k.id] === 'passed').length}
      total={levels.length}
      done={allDone}
    />
  );

  // Panel awal: topik yang disarankan, atau topik pertama yang belum lulus.
  const fallback =
    nextCode ?? shelves.find((s) => infos.get(s.code)?.state !== 'lulus')?.code ?? shelves[0]?.code;
  const [chosen, setChosen] = useState<string>();
  // Bab yang sudah selesai semua dilipat; anak bisa membukanya lagi.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    setChosen(undefined);
    setOpened(false);
  }, [book.slug]);
  const selected = shelves.find((s) => s.code === (chosen ?? fallback));
  const panelRef = useRef<HTMLElement>(null);
  const [scrollTo, setScrollTo] = useState(0);
  useEffect(() => {
    if (!scrollTo || wide) return;
    panelRef.current?.scrollIntoView?.({
      behavior: reducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [scrollTo, wide]);

  const choose = (s: Shelf) => {
    speak(s.title);
    setChosen(s.code);
    setScrollTo((n) => n + 1);
  };

  const complete = shelves.length > 0 && doneCount === shelves.length;
  const folded = complete && !opened;
  // Di ponsel panel menjadi baris selebar jalur, tepat di bawah baris simpul yang dipilih.
  const selIndex = selected ? shelves.indexOf(selected) : -1;
  const panelRow = !wide && !folded && selIndex >= 0 ? snake(selIndex, cols).row : -1;

  const panel = selected && (
    <PetaPanel
      ref={panelRef}
      id="peta-panel"
      shelf={selected}
      info={infos.get(selected.code)!}
      n={selIndex + 1}
      premium={premium}
      momoColor={momoColor}
    />
  );

  return (
    <div className={`peta${wide ? ' is-wide' : ''}`}>
      <div className="peta-babs" ref={babsRef}>
        {allDone ? (
          <AllDone momoColor={momoColor} title={book.title} cert={cert} />
        ) : (
          <Summary done={doneCount} total={shelves.length} cert={cert} />
        )}
        <section
          className={`peta-bab${complete ? ' is-complete' : ''}`}
          data-mapel={mapelOfSlug(book.slug)}
          aria-label={book.title}
        >
          <header className="peta-bab-head">
            <span className="peta-bab-text">
              <strong>{book.title}</strong>
            </span>
            <BabProgress done={doneCount} total={shelves.length} />
            <SpeakButton
              text={complete ? `${book.title}. ${t('play.peta.babDoneSay')}` : book.title}
            />
          </header>
          {complete && (
            <div className="peta-bab-done">
              <span className="peta-bab-done-text">
                <CheckMark size={26} />
                {t('play.peta.babDone')}
              </span>
              <button
                type="button"
                className="peta-fold"
                aria-expanded={!folded}
                onClick={() => setOpened((o) => !o)}
              >
                {folded ? t('play.peta.babShow') : t('play.peta.babHide')}
              </button>
            </div>
          )}
          {!folded && (
            <ol className="peta-path" style={{ '--cols': cols } as CSSProperties}>
              {shelves.map((s, i) => {
                const info = infos.get(s.code)!;
                const { row, col } = snake(i, cols);
                const last = i === shelves.length - 1;
                const nextRow = last ? row : snake(i + 1, cols).row;
                // Garis ke simpul berikutnya: mendatar di baris yang sama, turun di ujung baris (kecuali panel
                // terbuka di antara dua baris itu).
                const link = last
                  ? ''
                  : nextRow !== row
                    ? row === panelRow
                      ? ''
                      : ' to-down'
                    : row % 2 === 0
                      ? ' to-right'
                      : ' to-left';
                const style = {
                  gridRow: row + 1 + (panelRow >= 0 && row > panelRow ? 1 : 0),
                  gridColumn: col + 1,
                } as CSSProperties;
                return (
                  <li
                    key={s.code}
                    className={`peta-row${link}${info.state === 'lulus' ? ' is-link-done' : ''}`}
                    style={style}
                  >
                    <Node
                      shelf={s}
                      n={i + 1}
                      info={info}
                      selected={s === selected}
                      momoColor={momoColor}
                      onChoose={() => choose(s)}
                    />
                  </li>
                );
              })}
              {panelRow >= 0 && (
                <li className="peta-panel-row" style={{ gridRow: panelRow + 2 }}>
                  {panel}
                </li>
              )}
            </ol>
          )}
        </section>
      </div>
      {wide && panel && <div className="peta-side">{panel}</div>}
    </div>
  );
}

/** Ringkasan kemajuan buku (berapa topik lulus + bilah hijau) dan keterangan tanda peta dalam satu kartu. */
function Summary({ done, total, cert }: { done: number; total: number; cert: ReactNode }) {
  const text = t('play.peta.summary', { done, total });
  return (
    <div className="peta-summary">
      <div className="peta-summary-row">
        <span className="peta-summary-text">
          <strong>{text}</strong>
          <span className="peta-bar" aria-hidden="true">
            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </span>
        </span>
        <SpeakButton text={text} />
      </div>
      {cert}
      <Legend />
    </div>
  );
}

/** Tautan ke Sertifikat Juara Digital buku ini: kemajuan level, atau lihat sertifikat bila semua lulus. */
function CertLink({
  slug,
  passed,
  total,
  done,
}: {
  slug: string;
  passed: number;
  total: number;
  done: boolean;
}) {
  return (
    <Link className={`peta-cert${done ? ' is-done' : ''}`} to={`/play/sertifikat/${slug}`}>
      <MedalIcon size={26} />
      <span>{done ? t('play.peta.certDone') : t('play.peta.cert', { passed, total })}</span>
    </Link>
  );
}

/** Semua topik di buku ini lulus: perayaan dengan Momo bangga, pujian untuk usaha. */
function AllDone({
  momoColor,
  title,
  cert,
}: {
  momoColor: string;
  title: string;
  cert: ReactNode;
}) {
  const say = `${t('play.peta.allDone')} ${t('play.peta.allDoneBody', { book: title })}`;
  return (
    <div className="peta-alldone" role="status">
      <RebungBand />
      <div className="peta-alldone-body">
        <Momo color={momoColor} mood="proud" size={88} />
        <span className="peta-alldone-text">
          <strong>
            <TrophyIcon size={30} />
            {t('play.peta.allDone')}
          </strong>
          <span>{t('play.peta.allDoneBody', { book: title })}</span>
        </span>
        <SpeakButton text={say} />
      </div>
      {cert}
    </div>
  );
}

/** Keterangan tanda di peta, dengan tombol dengar (anak yang belum membaca). */
function Legend() {
  const items: { key: string; icon: ReactNode; label: string }[] = [
    { key: 'now', icon: <span className="peta-key-dot is-now" />, label: t('play.peta.now') },
    { key: 'next', icon: <ArrowIcon />, label: t('play.peta.next') },
    { key: 'jump', icon: <JumpIcon />, label: t('play.peta.jump') },
    { key: 'done', icon: <CheckMark size={20} />, label: t('play.peta.done') },
    { key: 'locked', icon: <LockIcon size={18} />, label: t('play.peta.locked') },
  ];
  return (
    <div className="peta-legend">
      <ul aria-label={t('play.peta.legend')}>
        {items.map((it) => (
          <li key={it.key} className={`peta-key is-${it.key}`}>
            <span className="peta-key-icon" aria-hidden="true">
              {it.icon}
            </span>
            {it.label}
          </li>
        ))}
      </ul>
      <SpeakButton text={t('play.peta.legendSay')} label={t('play.peta.legendListen')} />
    </div>
  );
}

/** "3/5" topik lulus di bab ini, dengan cincin kecil. */
function BabProgress({ done, total }: { done: number; total: number }) {
  return (
    <span
      className="peta-bab-count"
      style={{ '--p': `${total ? (done / total) * 100 : 0}%` } as CSSProperties}
      aria-label={t('play.peta.summary', { done, total })}
    >
      {done}/{total}
    </span>
  );
}

function CheckMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M12 25l8 8 16-17"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Panah ke kanan: topik berikutnya. */
function ArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 12h14M12 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Lengkung melompat: topik terbuka yang boleh dipilih kapan saja. */
function JumpIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M3 18c2-9 11-12 16-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M20 6v6h-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 21h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Stars({ n, size = 20 }: { n: number; size?: number }) {
  return (
    <span className="peta-stars" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={i < n ? 'is-on' : ''}
        >
          <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}

const STATE_KEY = {
  lulus: 'play.peta.state.done',
  sekarang: 'play.peta.state.now',
  terbuka: 'play.peta.state.open',
  terkunci: 'play.peta.state.locked',
} as const;
const MARK_KEY = { berikutnya: 'play.peta.state.next', lompat: 'play.peta.state.jump' } as const;

export const nodeLabel = (title: string, info: NodeInfo) => {
  const base = t('play.peta.nodeLabel', {
    topic: title,
    state: t(STATE_KEY[info.state]),
    stars: info.stars,
  });
  return info.mark ? `${base}, ${t(MARK_KEY[info.mark])}` : base;
};

function Node({
  shelf,
  n,
  info,
  selected,
  momoColor,
  onChoose,
}: {
  shelf: Shelf;
  n: number;
  info: NodeInfo;
  selected: boolean;
  momoColor: string;
  onChoose: () => void;
}) {
  const ring = info.total ? (info.passed / info.total) * 100 : 0;
  return (
    <button
      type="button"
      className={`peta-stop is-${info.state}${info.mark ? ` is-${info.mark}` : ''}${selected ? ' is-selected' : ''}`}
      aria-label={nodeLabel(shelf.title, info)}
      aria-expanded={selected}
      aria-controls={selected ? 'peta-panel' : undefined}
      onClick={onChoose}
    >
      <span className="peta-flag" aria-hidden="true">
        {info.state === 'sekarang' ? (
          <span className="peta-tag is-now">{t('play.peta.now')}</span>
        ) : info.mark === 'berikutnya' ? (
          <span className="peta-tag is-next">
            {t('play.peta.next')}
            <ArrowIcon size={14} />
          </span>
        ) : null}
      </span>
      <span className="peta-ring" style={{ '--p': `${ring}%` } as CSSProperties}>
        <span className="peta-node">
          {info.state === 'lulus' ? (
            <CheckMark />
          ) : info.state === 'terkunci' ? (
            <LockIcon size={28} />
          ) : (
            <span className="peta-num">{n}</span>
          )}
        </span>
        {info.state === 'sekarang' && (
          <span className="peta-here">
            <Momo color={momoColor} mood="happy" size={40} />
          </span>
        )}
        {info.mark === 'lompat' && (
          <span className="peta-jump">
            <JumpIcon size={16} />
          </span>
        )}
      </span>
      <Stars n={info.stars} size={16} />
      <span className="peta-name">{shelf.title}</span>
    </button>
  );
}
