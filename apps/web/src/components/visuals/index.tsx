import type { MomoColor, PinPicture } from '@udakids/engine';
import { PinPictureIcon } from '../PicturePin';

export type Visual = { kind: 'object'; object: PinPicture } | { kind: 'swatch'; color: MomoColor };

const SWATCH: Record<MomoColor, string> = {
  blue: 'var(--uk-momo-blue)',
  green: 'var(--uk-momo-green)',
  yellow: 'var(--uk-momo-yellow)',
  orange: 'var(--uk-momo-orange)',
  pink: 'var(--uk-momo-pink)',
  teal: 'var(--uk-momo-teal)',
};

/** Gambar kecil untuk sandi gambar dan pilihan warna Momo. */
export function VisualView({ visual, size = 48 }: { visual: Visual; size?: number }) {
  if (visual.kind === 'object') return <PinPictureIcon name={visual.object} size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="19"
        fill={SWATCH[visual.color]}
        stroke="var(--garis-tegas)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
