import { useEffect, useId, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import './controls.css';

/** Kontrol formulir kecil untuk area dewasa: sakelar, pilihan segmen, dan penambah angka. */

/**
 * Sakelar hidup/mati. Seluruh baris (tombol dan teksnya) bisa diketuk; pembaca layar mengenalnya sebagai
 * `switch` dengan keterangan.
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="ui-switch-row">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        className="ui-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="ui-switch-thumb" aria-hidden />
      </button>
      <div className="ui-switch-text">
        <label htmlFor={id}>{label}</label>
        {hint && (
          <small id={`${id}-hint`} className="ui-hint">
            {hint}
          </small>
        )}
      </div>
    </div>
  );
}

export type SegmentOption<V extends string> = {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  /** Nada warna saat dipilih. */
  tone?: 'success' | 'warning' | 'neutral';
};

/** Pilihan satu dari dua sampai empat opsi pendek (mis. Gratis atau Premium) yang selalu terlihat. */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: V;
  options: readonly SegmentOption<V>[];
  onChange: (next: V) => void;
  /** Nama untuk pembaca layar, mis. "Akses level 3". */
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="ui-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={disabled || o.disabled}
          className={`ui-seg-btn${o.tone ? ` ui-seg-${o.tone}` : ''}`}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Angka dengan tombol kurang dan tambah; ketikan langsung tetap bisa, nilai selalu dijepit ke batas. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const settle = (raw: string) => {
    const n = Number(raw);
    const next = raw.trim() === '' || !Number.isFinite(n) ? value : clamp(n);
    setText(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <div className="ui-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="ui-stepper-btn"
        aria-label={t('common.stepper.less')}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <svg viewBox="0 0 20 20" aria-hidden>
          <path d="M5 10h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max)
            onChange(Math.round(n));
        }}
        onBlur={(e) => settle(e.target.value)}
      />
      <button
        type="button"
        className="ui-stepper-btn"
        aria-label={t('common.stepper.more')}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <svg viewBox="0 0 20 20" aria-hidden>
          <path
            d="M5 10h10M10 5v10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
