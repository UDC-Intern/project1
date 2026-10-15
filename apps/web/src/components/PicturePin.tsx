import { PIN_LENGTH, PIN_PICTURES, type PinPicture } from '@udakids/engine';
import { useT } from '../i18n';
import { BigButton } from './BigButton';

const NAMES: Record<PinPicture, string> = {
  apple: 'Apel',
  star: 'Bintang',
  fish: 'Ikan',
  flower: 'Bunga',
  ball: 'Bola',
  cat: 'Kucing',
  house: 'Rumah',
  cloud: 'Awan',
  leaf: 'Daun',
};

export function PinPictureIcon({ name, size = 56 }: { name: PinPicture; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    role: 'img',
    'aria-label': NAMES[name],
  } as const;
  switch (name) {
    case 'apple':
      return (
        <svg {...common}>
          <circle cx="24" cy="28" r="14" fill="#c0392b" />
          <path
            d="M24 14 Q24 8 30 6"
            stroke="#2f9e63"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path
            d="M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18Z"
            fill="#f2b705"
          />
        </svg>
      );
    case 'fish':
      return (
        <svg {...common}>
          <ellipse cx="22" cy="24" rx="15" ry="9" fill="#3b82c4" />
          <path d="M36 24 L45 16 V32Z" fill="#3b82c4" />
          <circle cx="15" cy="22" r="2" fill="#ffffff" />
        </svg>
      );
    case 'flower':
      return (
        <svg {...common}>
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse
              key={r}
              cx="24"
              cy="12"
              rx="6"
              ry="9"
              fill="#ec7fa8"
              transform={`rotate(${r} 24 24)`}
            />
          ))}
          <circle cx="24" cy="24" r="6" fill="#f2b705" />
        </svg>
      );
    case 'ball':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="16" fill="#f08a24" />
          <path d="M8 24 H40 M24 8 V40" stroke="#ffffff" strokeWidth="3" />
        </svg>
      );
    case 'cat':
      return (
        <svg {...common}>
          <path d="M10 14 L16 22 H32 L38 14 V34 Q24 44 10 34Z" fill="#8a6a3c" />
          <circle cx="19" cy="28" r="2" fill="#ffffff" />
          <circle cx="29" cy="28" r="2" fill="#ffffff" />
        </svg>
      );
    case 'house':
      return (
        <svg {...common}>
          <path d="M6 24 L24 8 L42 24Z" fill="#c0392b" />
          <rect x="11" y="24" width="26" height="17" fill="#f2b705" />
          <rect x="20" y="30" width="8" height="11" fill="#8a6a3c" />
        </svg>
      );
    case 'cloud':
      return (
        <svg {...common}>
          <path d="M12 34 A9 9 0 0 1 14 17 A11 11 0 0 1 35 18 A8 8 0 0 1 36 34Z" fill="#9fc4e6" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M8 40 Q6 10 40 8 Q42 38 8 40Z" fill="#3fa66b" />
          <path d="M10 38 L30 18" stroke="#ffffff" strokeWidth="2.5" />
        </svg>
      );
  }
}

/** Sandi gambar: 3 kotak jawaban dan grid 3 x 3 untuk memilih gambar berurutan. */
export function PicturePin({
  value,
  onChange,
  shake = false,
}: {
  value: PinPicture[];
  onChange: (next: PinPicture[]) => void;
  shake?: boolean;
}) {
  const t = useT('play');
  return (
    <div className="kid-row" style={{ flexDirection: 'column', alignItems: 'center' }}>
      <p className="kid-say" style={{ margin: 0 }}>
        {t('pin.title')}
      </p>
      <div className={`pin-slots${shake ? ' shake' : ''}`} aria-live="polite">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className="pin-slot">
            {value[i] ? <PinPictureIcon name={value[i]} size={52} /> : null}
          </span>
        ))}
      </div>
      <div className="pin-grid">
        {PIN_PICTURES.map((name) => (
          <button
            key={name}
            type="button"
            className="pin-key"
            aria-label={NAMES[name]}
            aria-pressed={value.includes(name)}
            onClick={() => value.length < PIN_LENGTH && onChange([...value, name])}
          >
            <PinPictureIcon name={name} />
          </button>
        ))}
      </div>
      <BigButton variant="ghost" onClick={() => onChange([])}>
        {t('pin.clear')}
      </BigButton>
    </div>
  );
}
