import type { MomoColor } from '@udakids/engine';
import { CHARACTER_NAME } from '../config/app';

export type MomoMood =
  'neutral' | 'happy' | 'encourage' | 'proud' | 'curious' | 'idle' | 'sleepy' | 'oops';

/** Robot kecil buatan sendiri. Warna badan lewat CSS (currentColor), ekspresi lewat mulut dan alis. */
export function Momo({
  color = 'blue',
  mood = 'neutral',
  size = 96,
}: {
  color?: MomoColor | string;
  mood?: MomoMood;
  size?: number;
  /** Hiasan tambahan; belum dipakai. */
  look?: unknown;
}) {
  const face =
    mood === 'proud'
      ? 'happy'
      : mood === 'curious' || mood === 'idle' || mood === 'sleepy'
        ? 'neutral'
        : mood === 'oops'
          ? 'encourage'
          : mood;
  const mouth =
    face === 'happy'
      ? 'M40 56 Q50 67 60 56'
      : face === 'encourage'
        ? 'M43 61 H57'
        : 'M42 58 Q50 63 58 58';
  return (
    <span className="uk-momo" data-color={color} data-mood={face}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={CHARACTER_NAME}>
        <line
          x1="50"
          y1="8"
          x2="50"
          y2="20"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="50" cy="8" r="5" fill="currentColor" />
        <rect x="16" y="20" width="68" height="62" rx="18" fill="currentColor" />
        <rect x="24" y="28" width="52" height="46" rx="14" fill="#ffffff" />
        <circle cx="38" cy="44" r="4.5" fill="#23302b" />
        <circle cx="62" cy="44" r="4.5" fill="#23302b" />
        {face === 'encourage' && (
          <path
            d="M32 37 L44 33 M68 37 L56 33"
            stroke="#23302b"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        <path d={mouth} stroke="#23302b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <rect x="8" y="46" width="8" height="16" rx="4" fill="currentColor" />
        <rect x="84" y="46" width="8" height="16" rx="4" fill="currentColor" />
      </svg>
    </span>
  );
}
