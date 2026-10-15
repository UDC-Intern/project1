/** Dekorasi SVG bertema anak (tanpa emoji): bintang, awan, kartu program, balok.
 *  Ini ilustrasi (stiker), jadi hex langsung boleh dan sengaja sama di tema terang & gelap.
 *  Tanpa ungu: aksen yang dulu ungu kini merah gonjong. */

export function Star({
  className = '',
  size = 28,
  color = '#f7c948',
}: {
  className?: string;
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`decor ${className}`}
      aria-hidden
    >
      <path
        d="M24 3l6 13.5 14.5 1.5-11 10 3.2 14.5L24 35l-12.7 7.5 3.2-14.5-11-10L18 16.5z"
        fill={color}
        stroke="#1d1a2e"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Cloud({ className = '', width = 120 }: { className?: string; width?: number }) {
  return (
    <svg
      viewBox="0 0 120 64"
      width={width}
      height={(width * 64) / 120}
      className={`decor ${className}`}
      aria-hidden
    >
      <path
        d="M28 58c-13 0-22-8-22-19s9-18 20-18c3-11 13-18 25-18 14 0 24 9 26 21 2-1 5-1 7-1 11 0 20 8 20 18s-8 17-19 17z"
        fill="#fff"
        stroke="#1d1a2e"
        strokeWidth="3"
      />
    </svg>
  );
}

export type CardDir = 'up' | 'right' | 'down' | 'left';
const ROT: Record<CardDir, number> = { up: -90, right: 0, down: 90, left: 180 };

/** Kartu arah seperti di Buku Catatan Momo. */
export function ProgramCard({
  dir,
  color,
  className = '',
  size = 64,
}: {
  dir: CardDir;
  color: string;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`decor program-card ${className}`}
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        fill={color}
        stroke="#1d1a2e"
        strokeWidth="3"
      />
      <g transform={`rotate(${ROT[dir]} 32 32)`}>
        <path
          d="M16 32h26M32 20l12 12-12 12"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

export function Blocks({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 72" width="96" height="72" className={`decor ${className}`} aria-hidden>
      <rect
        x="4"
        y="36"
        width="30"
        height="30"
        rx="6"
        fill="#ff7a59"
        stroke="#1d1a2e"
        strokeWidth="3"
      />
      <rect
        x="36"
        y="36"
        width="30"
        height="30"
        rx="6"
        fill="#4aa8ff"
        stroke="#1d1a2e"
        strokeWidth="3"
      />
      <rect
        x="20"
        y="4"
        width="30"
        height="30"
        rx="6"
        fill="#46b97a"
        stroke="#1d1a2e"
        strokeWidth="3"
      />
      <text x="35" y="26" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff">
        A
      </text>
      <text x="19" y="58" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff">
        1
      </text>
      <text x="51" y="58" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff">
        +
      </text>
    </svg>
  );
}

/** Ikon besar untuk kartu fitur / pintu masuk. */
export type FeatureIcon =
  | 'child'
  | 'family'
  | 'class'
  | 'staff'
  | 'book'
  | 'math'
  | 'english'
  | 'science'
  | 'timer'
  | 'trophy'
  | 'shield'
  | 'offline'
  | 'voice'
  | 'noads';

export function Icon({ name, size = 44 }: { name: FeatureIcon; size?: number }) {
  const p = {
    viewBox: '0 0 48 48',
    width: size,
    height: size,
    'aria-hidden': true,
    className: 'site-icon',
  } as const;
  const ink = '#1d1a2e';
  switch (name) {
    case 'child':
      return (
        <svg {...p}>
          <circle cx="24" cy="16" r="10" fill="#ffd6a5" stroke={ink} strokeWidth="2.5" />
          <path
            d="M8 44c2-10 8-15 16-15s14 5 16 15z"
            fill="#c8321f"
            stroke={ink}
            strokeWidth="2.5"
          />
          <circle cx="20" cy="16" r="1.8" fill={ink} />
          <circle cx="28" cy="16" r="1.8" fill={ink} />
          <path d="M20 20q4 3 8 0" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'family':
      return (
        <svg {...p}>
          <circle cx="15" cy="13" r="7" fill="#ffd6a5" stroke={ink} strokeWidth="2.5" />
          <circle cx="33" cy="13" r="7" fill="#ffd6a5" stroke={ink} strokeWidth="2.5" />
          <circle cx="24" cy="27" r="5" fill="#ffd6a5" stroke={ink} strokeWidth="2.5" />
          <path d="M4 44c1-10 5-15 11-15 3 0 5 1 6 3" fill="none" stroke={ink} strokeWidth="2.5" />
          <path
            d="M44 44c-1-10-5-15-11-15-3 0-5 1-6 3"
            fill="none"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path d="M16 44c1-7 4-10 8-10s7 3 8 10z" fill="#46b97a" stroke={ink} strokeWidth="2.5" />
        </svg>
      );
    case 'class':
      return (
        <svg {...p}>
          <rect
            x="4"
            y="6"
            width="40"
            height="26"
            rx="4"
            fill="#19a58a"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path d="M11 14h14M11 21h20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M18 32l-5 12M30 32l5 12" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'staff':
      return (
        <svg {...p}>
          <path
            d="M24 4l18 7v11c0 11-8 19-18 22C14 41 6 33 6 22V11z"
            fill="#4aa8ff"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path
            d="M16 24l6 6 11-12"
            stroke="#fff"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'book':
      return (
        <svg {...p}>
          <path
            d="M6 8h14a6 6 0 0 1 4 2 6 6 0 0 1 4-2h14v32H28a4 4 0 0 0-4 3 4 4 0 0 0-4-3H6z"
            fill="#fff"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path d="M24 10v33" stroke={ink} strokeWidth="2.5" />
          <path
            d="M11 17h8M11 23h8M29 17h8M29 23h8"
            stroke="#c8321f"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'math':
      return (
        <svg {...p}>
          <rect
            x="5"
            y="5"
            width="38"
            height="38"
            rx="9"
            fill="#fff3c4"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path d="M15 17h8M19 13v8" stroke="#ff7a59" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M27 17h8" stroke="#4aa8ff" strokeWidth="3.5" strokeLinecap="round" />
          <path
            d="M15 31l6 6M21 31l-6 6"
            stroke="#c8321f"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path d="M27 31h8M27 37h8" stroke="#46b97a" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    case 'english':
      return (
        <svg {...p}>
          <path
            d="M8 8h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-9 8v-8H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
            fill="#dcefff"
            stroke={ink}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <text
            x="24"
            y="26"
            textAnchor="middle"
            fontFamily="inherit"
            fontSize="13"
            fontWeight="900"
            fill={ink}
          >
            ABC
          </text>
        </svg>
      );
    case 'science':
      return (
        <svg {...p}>
          <path
            d="M18 4h12M20 4v14L8 40a3 3 0 0 0 3 4h26a3 3 0 0 0 3-4L28 18V4"
            fill="#e7f7ef"
            stroke={ink}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M12 32h24l3 8a2 2 0 0 1-2 3H11a2 2 0 0 1-2-3z" fill="#46b97a" />
          <circle cx="20" cy="36" r="2.5" fill="#fff" />
          <circle cx="28" cy="33" r="1.8" fill="#fff" />
        </svg>
      );
    case 'timer':
      return (
        <svg {...p}>
          <circle cx="24" cy="27" r="17" fill="#fff" stroke={ink} strokeWidth="2.5" />
          <path
            d="M24 17v10l7 5"
            stroke="#ff7a59"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <rect
            x="18"
            y="3"
            width="12"
            height="6"
            rx="3"
            fill="#ff7a59"
            stroke={ink}
            strokeWidth="2"
          />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...p}>
          <path d="M14 6h20v12a10 10 0 0 1-20 0z" fill="#f7c948" stroke={ink} strokeWidth="2.5" />
          <path
            d="M14 10H7a7 7 0 0 0 7 9M34 10h7a7 7 0 0 1-7 9"
            fill="none"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path d="M20 28h8v7h-8z" fill="#f7c948" stroke={ink} strokeWidth="2.5" />
          <rect
            x="13"
            y="35"
            width="22"
            height="8"
            rx="2"
            fill="#c8321f"
            stroke={ink}
            strokeWidth="2.5"
          />
        </svg>
      );
    case 'shield':
      return (
        <svg {...p}>
          <path
            d="M24 4l18 7v11c0 11-8 19-18 22C14 41 6 33 6 22V11z"
            fill="#46b97a"
            stroke={ink}
            strokeWidth="2.5"
          />
          <rect x="17" y="21" width="14" height="11" rx="2" fill="#fff" />
          <path d="M20 21v-3a4 4 0 0 1 8 0v3" stroke="#fff" strokeWidth="3" fill="none" />
        </svg>
      );
    case 'offline':
      return (
        <svg {...p}>
          <rect
            x="12"
            y="4"
            width="24"
            height="40"
            rx="5"
            fill="#fff"
            stroke={ink}
            strokeWidth="2.5"
          />
          <path
            d="M18 18q6-5 12 0M21 22q3-2.5 6 0"
            stroke="#4aa8ff"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="24" cy="26" r="2" fill="#4aa8ff" />
          <path d="M16 34l16-16" stroke="#ff7a59" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'voice':
      return (
        <svg {...p}>
          <path
            d="M8 18h8l10-8v28l-10-8H8z"
            fill="#f7c948"
            stroke={ink}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M32 17q5 7 0 14M37 12q9 12 0 24"
            stroke={ink}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'noads':
      return (
        <svg {...p}>
          <circle cx="24" cy="24" r="19" fill="#fff" stroke={ink} strokeWidth="2.5" />
          <text x="24" y="30" textAnchor="middle" fontSize="15" fontWeight="800" fill={ink}>
            AD
          </text>
          <path d="M11 11l26 26" stroke="#ff7a59" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
  }
}

/** Lengkung atap gonjong rumah gadang dengan titik kunyit. */
export function GonjongArc({ width = 112 }: { width?: number }) {
  return (
    <svg
      className="uk-gonjong"
      viewBox="0 0 112 44"
      width={width}
      height={(width * 44) / 112}
      aria-hidden
    >
      <path d="M6 6 C24 22 36 30 56 30 C76 30 88 22 106 6" />
      <circle cx="56" cy="14" r="7" />
    </svg>
  );
}

/** Pita pucuk rebung: segitiga gonjong dan kunyit bergantian. */
export function RebungBand() {
  return (
    <svg className="uk-rebung" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="uk-rebung-pola" width="48" height="24" patternUnits="userSpaceOnUse">
          <path className="a" d="M0 24 L12 0 L24 24 Z" />
          <path className="b" d="M24 24 L36 4 L48 24 Z" />
        </pattern>
      </defs>
      <rect width="100%" height="24" fill="url(#uk-rebung-pola)" />
    </svg>
  );
}

/** Warna marawa: hitam, merah, kuning. */
export function MarawaIcon() {
  return (
    <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden className="about-name-marawa">
      <rect
        x="4"
        y="8"
        width="28"
        height="48"
        rx="6"
        fill="var(--ilustrasi-garis)"
        stroke="var(--garis-tegas)"
        strokeWidth="2"
      />
      <rect x="34" y="8" width="28" height="48" rx="6" fill="var(--gonjong)" />
      <rect x="64" y="8" width="28" height="48" rx="6" fill="var(--kunyit)" />
    </svg>
  );
}
