import { useT } from '../i18n';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Papan angka 0 sampai 9 untuk soal isian, maksimal 3 digit. Tombol periksa ada di halaman ronde. */
export function Keypad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  const t = useT('play');
  const add = (d: string) => value.length < 3 && onChange(value + d);
  return (
    <div className="keypad-wrap">
      <output className="keypad-display" aria-live="polite">
        {value || ' '}
      </output>
      <div className="keypad">
        {DIGITS.map((d) => (
          <button key={d} type="button" className="key" disabled={disabled} onClick={() => add(d)}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="key"
          disabled={disabled}
          onClick={() => onChange(value.slice(0, -1))}
        >
          {t('round.clear')}
        </button>
        <button type="button" className="key" disabled={disabled} onClick={() => add('0')}>
          0
        </button>
      </div>
    </div>
  );
}
