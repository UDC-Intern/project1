import { useT } from '../i18n';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Papan angka 0 sampai 9 untuk soal isian. Maksimal 3 digit. */
export function Keypad({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const t = useT('play');
  const add = (d: string) => value.length < 3 && onChange(value + d);
  return (
    <div className="uk-keypad-wrap">
      <output className="uk-keypad-display" aria-live="polite">
        {value || ' '}
      </output>
      <div className="uk-keypad">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className="uk-key"
            disabled={disabled}
            onClick={() => add(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="uk-key"
          disabled={disabled}
          onClick={() => onChange(value.slice(0, -1))}
        >
          {t('round.clear')}
        </button>
        <button type="button" className="uk-key" disabled={disabled} onClick={() => add('0')}>
          0
        </button>
        <button
          type="button"
          className="uk-key uk-key--go"
          disabled={disabled || value.length === 0}
          onClick={onSubmit}
        >
          {t('round.check')}
        </button>
      </div>
    </div>
  );
}
