import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/** Grafik SVG dan CSS buatan sendiri. Semua angka juga tersedia sebagai teks untuk pembaca layar. */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Angka yang berhitung naik saat tampil. Nilai akhir selalu ada di aria-label. */
export function CountUp({
  value,
  format = (n) => n.toLocaleString('id-ID'),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(origin + (value - origin) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span aria-label={format(value)}>{format(shown)}</span>;
}

export function Kpi({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{children}</strong>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

export function Ring({
  percent,
  size = 56,
  label,
}: {
  percent: number;
  size?: number;
  label: string;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={`${label}: ${p}%`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--garis)" strokeWidth="7" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="var(--sawah)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--malam)">
        {p}
      </text>
    </svg>
  );
}

export function Meter({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="meter" role="img" aria-label={`${label}: ${p}%`}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

const COLORS = [
  'var(--gonjong)',
  'var(--sawah)',
  'var(--langit)',
  'var(--kunyit-tekan)',
  'var(--toska)',
];
export const chartColor = (i: number) => COLORS[i % COLORS.length]!;

export type Series = { label: string; values: number[]; color?: string };

/** Grafik garis dengan beberapa seri. Setiap titik punya tooltip bawaan (title). */
export function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const w = 640;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = Math.ceil(max / 4) * 4 || 4;
  const x = (i: number) =>
    pad.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (w - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / nice) * (height - pad.t - pad.b);
  const step = Math.max(1, Math.ceil(labels.length / 7));

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={series.map((s) => s.label).join(', ')}
      >
        {[0, 1, 2, 3, 4].map((g) => {
          const v = (nice / 4) * g;
          return (
            <g key={g}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--garis)" />
              <text
                x={pad.l - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--malam-muted)"
              >
                {v}
              </text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const color = s.color ?? chartColor(si);
          const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
          return (
            <g key={s.label}>
              <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={color}>
                  <title>{`${labels[i]}: ${v} (${s.label})`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="var(--malam-muted)"
            >
              {l}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="chart-legend">
        {series.map((s, i) => (
          <span key={s.label}>
            <i style={{ background: s.color ?? chartColor(i) }} /> {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function ColumnChart({
  labels,
  values,
  format = (n) => String(n),
  height = 200,
  color = 'var(--sawah)',
}: {
  labels: string[];
  values: number[];
  format?: (n: number) => string;
  height?: number;
  color?: string;
}) {
  const w = 640;
  const pad = { l: 8, r: 8, t: 12, b: 28 };
  const max = Math.max(1, ...values);
  const slot = (w - pad.l - pad.r) / Math.max(1, values.length);
  const bar = Math.min(32, slot * 0.7);
  const step = Math.max(1, Math.ceil(labels.length / 7));
  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={labels.map((l, i) => `${l}: ${format(values[i] ?? 0)}`).join(', ')}
      >
        <line
          x1={pad.l}
          x2={w - pad.r}
          y1={height - pad.b}
          y2={height - pad.b}
          stroke="var(--garis-tegas)"
        />
        {values.map((v, i) => {
          const h = (v / max) * (height - pad.t - pad.b);
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={i}>
              <rect
                x={cx - bar / 2}
                y={height - pad.b - h}
                width={bar}
                height={h}
                rx="5"
                fill={color}
              >
                <title>{`${labels[i]}: ${format(v)}`}</title>
              </rect>
              {i % step === 0 && (
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--malam-muted)"
                >
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function Donut({ slices }: { slices: { label: string; value: number }[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <figure className="chart donut">
      <svg
        viewBox="0 0 140 140"
        width="160"
        height="160"
        role="img"
        aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--garis)" strokeWidth="22" />
        {slices.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={chartColor(i)}
              strokeWidth="22"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <figcaption className="chart-legend vertical">
        {slices.map((s, i) => (
          <span key={s.label}>
            <i style={{ background: chartColor(i) }} /> {s.label}{' '}
            <strong>{Math.round((s.value / total) * 100)}%</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="funnel">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.value : steps[i - 1]!.value;
        const drop = prev > 0 ? Math.round((s.value / prev) * 100) : 0;
        return (
          <li key={s.label}>
            <div
              className="funnel-bar"
              style={{ width: `${Math.max(8, (s.value / top) * 100)}%`, background: chartColor(i) }}
              title={s.label}
            >
              <span>{s.label}</span>
            </div>
            <span className="funnel-value">
              {s.value.toLocaleString('id-ID')}
              {i > 0 && <small> ({drop}% dari langkah sebelumnya)</small>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Satu sel heatmap: baris, kolom, nilainya, dan nilai terbesar di seluruh heatmap. */
export type HeatmapCell = { row: number; col: number; value: number; max: number };

export type HeatLevel = 'busy' | 'medium' | 'quiet';

/** Tingkat keramaian sebuah sel dibanding sel paling ramai: dari dua pertiga ke atas ramai sekali, dari seperempat sedang. */
export function heatLevel(value: number, max: number): HeatLevel {
  if (value <= 0 || max <= 0) return 'quiet';
  const share = value / max;
  return share >= 0.66 ? 'busy' : share >= 0.25 ? 'medium' : 'quiet';
}

/** Lebar dan tinggi popover (px), dipakai untuk menjaganya tetap di layar. */
const TIP_W = 276;
const TIP_H = 128;
const TIP_EDGE = 8;

type Tip = { row: number; col: number; x: number; y: number; below: boolean };

/**
 * Peta panas: baris (mis. hari) dan kolom (mis. jam), makin pekat makin besar nilainya. Mengarahkan kursor, mengetuk,
 * atau memfokuskan sebuah sel membuka popover berisi rincian dari `tip`; papan ketik bergerak antar sel dengan panah
 * (satu sel saja yang bisa dicapai dengan Tab). `label` adalah kalimat lengkap sel untuk pembaca layar.
 */
export function Heatmap({
  matrix,
  rowLabels,
  colLabels,
  ariaLabel,
  label,
  tip,
}: {
  matrix: number[][];
  rowLabels: string[];
  colLabels: string[];
  ariaLabel: string;
  label: (cell: HeatmapCell) => string;
  tip: (cell: HeatmapCell) => ReactNode;
}) {
  const max = Math.max(1, ...matrix.flat());
  const grid = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Tip | null>(null);
  const [stop, setStop] = useState({ row: 0, col: 0 });
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  const show = (row: number, col: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const half = TIP_W / 2 + TIP_EDGE;
    const x = Math.min(Math.max(r.left + r.width / 2, half), window.innerWidth - half);
    const below = r.top < TIP_H + TIP_EDGE * 2;
    setShown({ row, col, x, y: below ? r.bottom + 6 : r.top - 6, below });
  };

  // Popover ikut hilang saat halaman digulir atau diubah ukurannya, supaya tidak tertinggal di tempat yang salah.
  useEffect(() => {
    if (!shown) return;
    const hide = () => setShown(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [shown]);

  const focusCell = (row: number, col: number) => {
    const r = Math.min(rows - 1, Math.max(0, row));
    const c = Math.min(cols - 1, Math.max(0, col));
    setStop({ row: r, col: c });
    grid.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus();
  };

  function onKeyDown(e: KeyboardEvent<HTMLElement>, row: number, col: number) {
    const move: Record<string, [number, number]> = {
      ArrowRight: [row, col + 1],
      ArrowLeft: [row, col - 1],
      ArrowDown: [row + 1, col],
      ArrowUp: [row - 1, col],
      Home: [row, 0],
      End: [row, cols - 1],
    };
    if (e.key === 'Escape') setShown(null);
    else if (move[e.key]) {
      e.preventDefault();
      focusCell(...move[e.key]!);
    }
  }

  const cell = (row: number, col: number): HeatmapCell => ({
    row,
    col,
    value: matrix[row]?.[col] ?? 0,
    max,
  });

  return (
    <div className="heatmap-wrap">
      <div ref={grid} className="heatmap" role="grid" aria-label={ariaLabel}>
        <div className="heatmap-row heatmap-head" role="row">
          <span role="presentation" />
          {colLabels.map((c, i) => (
            <span key={i} role="columnheader" aria-label={c}>
              {i % 3 === 0 ? c : ''}
            </span>
          ))}
        </div>
        {matrix.map((line, r) => (
          <div key={r} className="heatmap-row" role="row">
            <span className="heatmap-label" role="rowheader">
              {rowLabels[r]}
            </span>
            {line.map((v, c) => (
              <span
                key={c}
                role="gridcell"
                data-cell={`${r}-${c}`}
                className={`heatmap-cell${shown?.row === r && shown.col === c ? ' is-shown' : ''}`}
                style={{ opacity: v === 0 ? 0.12 : 0.25 + (v / max) * 0.75 }}
                tabIndex={stop.row === r && stop.col === c ? 0 : -1}
                aria-label={label(cell(r, c))}
                onMouseEnter={(e) => show(r, c, e.currentTarget)}
                onMouseLeave={() => setShown(null)}
                onFocus={(e) => {
                  setStop({ row: r, col: c });
                  show(r, c, e.currentTarget);
                }}
                onBlur={() => setShown(null)}
                onKeyDown={(e) => onKeyDown(e, r, c)}
              />
            ))}
          </div>
        ))}
      </div>
      {shown && (
        <div
          className={`heatmap-tip${shown.below ? ' is-below' : ''}`}
          role="tooltip"
          style={{ left: shown.x, top: shown.y, width: TIP_W }}
        >
          {tip(cell(shown.row, shown.col))}
        </div>
      )}
    </div>
  );
}
