import { useEffect, useRef, useState, type ReactNode } from 'react';
import './charts.css';

/** Komponen grafik ringan (tanpa pustaka) untuk dasbor orang tua, admin, dan guru. */
const reducedMotion = () =>
  typeof window === 'undefined' ||
  typeof window.matchMedia !== 'function' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Angka yang naik perlahan saat muncul (langsung bila gerak dikurangi). */
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setValue(target);
      return;
    }
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(base + (target - base) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** Bernilai true sesaat setelah muncul — untuk memicu transisi CSS (batang, cincin). */
export function useMounted() {
  const [on, setOn] = useState(reducedMotion);
  useEffect(() => {
    if (on) return;
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, [on]);
  return on;
}

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const n = useCountUp(value);
  return <>{format ? format(n) : n.toLocaleString('id-ID')}</>;
}

export function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
  i = 0,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone: 'grape' | 'leaf' | 'sky' | 'sun' | 'coral';
  i?: number;
}) {
  return (
    <div className={`pd-kpi tone-${tone} pd-rise`} style={{ ['--i' as string]: i }}>
      <span className="pd-kpi-icon" aria-hidden>
        {icon}
      </span>
      <span className="pd-kpi-value">{value}</span>
      <span className="pd-kpi-label">{label}</span>
      {hint && <span className="pd-kpi-hint">{hint}</span>}
    </div>
  );
}

/** Cincin persen (SVG) yang terisi saat muncul. */
export function Ring({
  percent,
  size = 64,
  label,
}: {
  percent: number;
  size?: number;
  label: string;
}) {
  const on = useMounted();
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className="pd-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
    >
      <circle cx={size / 2} cy={size / 2} r={r} className="pd-ring-bg" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="pd-ring-fg"
        strokeDasharray={c}
        strokeDashoffset={on ? c * (1 - percent / 100) : c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="pd-ring-text">
        {percent}%
      </text>
    </svg>
  );
}

/** Bar horizontal (proporsi), mis. status pesanan atau buku terpopuler. */
export function Meter({
  value,
  max,
  tone = 'grape',
}: {
  value: number;
  max: number;
  tone?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className={`ch-meter tone-${tone}`} aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}
