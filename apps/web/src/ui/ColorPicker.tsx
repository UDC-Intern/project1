import { MOMO_COLORS, type MomoColor } from '@udakids/engine';
import { Momo } from '../components/Momo';
import { useT } from '../i18n';

/** Enam warna Momo. Tiap pilihan punya nama teks untuk pembaca layar. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: MomoColor;
  onChange: (next: MomoColor) => void;
}) {
  const t = useT('parent');
  return (
    <div className="uk-swatches">
      {MOMO_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className="uk-swatch-btn"
          aria-label={t(`color.${c}`)}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
        >
          <Momo color={c} size={44} />
        </button>
      ))}
    </div>
  );
}
