import { MOMO_COLORS, SAY_COLOR, type Color } from '@udakids/engine';
import { VisualView } from '../components/visuals';

/** Pilihan warna Momo sebagai grup radio (bisa keyboard & mouse). */
export function ColorPicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: Color;
  onChange: (c: Color) => void;
}) {
  return (
    <fieldset className="pa-colors">
      <legend>{label}</legend>
      {hint && <small className="ui-hint">{hint}</small>}
      <div className="pa-colors-row">
        {MOMO_COLORS.map((c) => (
          <label key={c} className={c === value ? 'pa-color selected' : 'pa-color'}>
            <input
              type="radio"
              name="momoColor"
              value={c}
              checked={c === value}
              onChange={() => onChange(c)}
            />
            <span aria-hidden className="pa-color-swatch">
              <VisualView visual={{ kind: 'swatch', color: c }} size={40} />
            </span>
            <span className="pa-color-name">{SAY_COLOR[c]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
