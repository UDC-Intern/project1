import { useEffect, useRef, useState, type ReactNode } from 'react';

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

export function Heatmap({
  matrix,
  rowLabels,
  colLabels,
}: {
  matrix: number[][];
  rowLabels: string[];
  colLabels: string[];
}) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="heatmap" role="table" aria-label="Jam paling aktif">
      <div className="heatmap-row heatmap-head" role="row">
        <span />
        {colLabels.map((c, i) => (
          <span key={i} role="columnheader">
            {i % 3 === 0 ? c : ''}
          </span>
        ))}
      </div>
      {matrix.map((row, r) => (
        <div key={r} className="heatmap-row" role="row">
          <span className="heatmap-label" role="rowheader">
            {rowLabels[r]}
          </span>
          {row.map((v, c) => (
            <span
              key={c}
              role="cell"
              className="heatmap-cell"
              style={{ opacity: v === 0 ? 0.12 : 0.25 + (v / max) * 0.75 }}
              title={`${rowLabels[r]} ${colLabels[c]}: ${v} ronde`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
