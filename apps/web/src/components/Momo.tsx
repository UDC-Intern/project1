import type { MomoColor } from '@udakids/engine';
import { CHARACTER_NAME } from '../config/app';

export type MomoMood = 'neutral' | 'happy' | 'encourage';

/** Robot kecil buatan sendiri. Warna badan lewat CSS (currentColor), ekspresi lewat mulut dan alis. */
export function Momo({
  color = 'blue',
  mood = 'neutral',
  size = 96,
}: {
  color?: MomoColor;
  mood?: MomoMood;
  size?: number;
}) {
  const mouth =
    mood === 'happy'
      ? 'M38 66 Q50 78 62 66'
      : mood === 'encourage'
        ? 'M40 70 H60'
        : 'M40 68 Q50 72 60 68';
  return (
    <span className="uk-momo" data-color={color} data-mood={mood}>
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
        <rect x="26" y="32" width="48" height="36" rx="12" fill="#ffffff" />
        <circle cx="39" cy="48" r="5" fill="#23302b" />
        <circle cx="61" cy="48" r="5" fill="#23302b" />
        {mood === 'encourage' && (
          <path
            d="M33 38 L45 41 M67 38 L55 41"
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
