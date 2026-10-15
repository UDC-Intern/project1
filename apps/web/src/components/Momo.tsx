import { createContext, useContext, useId, type ReactNode } from 'react';
import {
  ACCESSORY_DEFAULT_TONE,
  DEFAULT_MOMO_MODEL,
  EXTRA_DEFAULT_TONE,
  MOMO_TONES,
  momoHex,
  type MomoAccessory,
  type MomoExtra,
  type MomoLook,
  type MomoModel,
  type MomoPattern,
} from '@udakids/engine';

export type MomoMood =
  'happy' | 'curious' | 'oops' | 'proud' | 'sleepy' | 'idle' | 'neutral' | 'encourage';

/** Nama warna: id aplikasi (blue, green, ...) atau nama palet Momo (biru, hijau, ...). */
type Color = string;

const BODY: Record<string, string> = {
  blue: '#3b82c4',
  green: '#3fa66b',
  yellow: '#f2b705',
  orange: '#f08a24',
  pink: '#ec7fa8',
  teal: '#2aa5a0',
  merah: '#ef6f6c',
  biru: '#4f8ff7',
  kuning: '#f7c948',
  hijau: '#46b97a',
  ungu: '#8a6cf0',
  oranye: '#f79a4a',
};

/** Tampilan Momo milik anak yang sedang bermain (D-051); dipakai oleh `<Momo own />`. */
const OwnLook = createContext<MomoLook | null>(null);
export function OwnMomoLook({ look, children }: { look: MomoLook | null; children: ReactNode }) {
  return <OwnLook.Provider value={look}>{children}</OwnLook.Provider>;
}

const LINE = '#2b2540';
/** Aksesori yang menutupi kepala → antena disembunyikan. */
const HIDES_ANTENNA: ReadonlySet<MomoAccessory> = new Set([
  'topi',
  'topi-terbalik',
  'peci',
  'jilbab',
  'mahkota',
  'rambut-jabrik',
  'rambut-mohawk',
]);

type Box = { x: number; y: number; w: number; h: number; rx: number };
/** Bentuk kepala tiap model (D-102). Layar wajah (x 28–84, y 34–76) selalu muat di dalamnya. */
const HEAD: Record<MomoModel, Box> = {
  udakids: { x: 16, y: 22, w: 80, h: 62, rx: 24 },
  kotak: { x: 16, y: 20, w: 80, h: 64, rx: 24 },
  bulat: { x: 14, y: 18, w: 84, h: 68, rx: 34 },
  kucing: { x: 16, y: 20, w: 80, h: 64, rx: 20 },
  kelinci: { x: 16, y: 20, w: 80, h: 64, rx: 26 },
  beruang: { x: 15, y: 20, w: 82, h: 65, rx: 28 },
  alien: { x: 14, y: 22, w: 84, h: 62, rx: 30 },
  tv: { x: 14, y: 20, w: 84, h: 66, rx: 8 },
  dino: { x: 16, y: 20, w: 80, h: 64, rx: 22 },
};
const BODY_BOX: Box = { x: 30, y: 86, w: 52, h: 30, rx: 12 };

/** Telinga / duri / antena khusus model, digambar di belakang kepala. */
function ModelBack({ model, fill, mood }: { model: MomoModel; fill: string; mood: string }) {
  const stroke = { stroke: LINE, strokeWidth: 4, strokeLinejoin: 'round' as const };
  const bulb = mood === 'proud' ? '#f7c948' : '#ffe08a';
  switch (model) {
    case 'udakids':
      // Antena gonjong (lengkung atap rumah gadang) dengan dua ujung kunyit (D-113).
      return (
        <g className="momo-antenna">
          <path
            d="M20 7 C30 16 40 18 56 18 C72 18 82 16 92 7"
            fill="none"
            stroke={LINE}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="20" cy="6" r="5.5" fill={mood === 'proud' ? '#ffc93c' : '#f5b301'} />
          <circle cx="92" cy="6" r="5.5" fill={mood === 'proud' ? '#ffc93c' : '#f5b301'} />
          <rect x="53" y="16" width="6" height="8" rx="2" fill={LINE} />
        </g>
      );
    case 'kucing':
      return (
        <g fill={fill} {...stroke}>
          <path d="M20 34 L24 4 L46 24 Z" />
          <path d="M92 34 L88 4 L66 24 Z" />
          <path d="M26 24 L28 12 L36 21 Z" fill="#ffb3b0" stroke="none" />
          <path d="M86 24 L84 12 L76 21 Z" fill="#ffb3b0" stroke="none" />
        </g>
      );
    case 'kelinci':
      return (
        <g {...stroke}>
          <ellipse cx="38" cy="10" rx="8" ry="20" fill={fill} transform="rotate(-12 38 10)" />
          <ellipse cx="74" cy="10" rx="8" ry="20" fill={fill} transform="rotate(12 74 10)" />
          <ellipse
            cx="38"
            cy="10"
            rx="3.5"
            ry="13"
            fill="#ffb3b0"
            stroke="none"
            transform="rotate(-12 38 10)"
          />
          <ellipse
            cx="74"
            cy="10"
            rx="3.5"
            ry="13"
            fill="#ffb3b0"
            stroke="none"
            transform="rotate(12 74 10)"
          />
        </g>
      );
    case 'beruang':
      return (
        <g {...stroke}>
          <circle cx="24" cy="24" r="12" fill={fill} />
          <circle cx="88" cy="24" r="12" fill={fill} />
          <circle cx="24" cy="24" r="5" fill="#ffb3b0" stroke="none" />
          <circle cx="88" cy="24" r="5" fill="#ffb3b0" stroke="none" />
        </g>
      );
    case 'alien':
      return (
        <g stroke={LINE} strokeWidth="4" strokeLinecap="round">
          <line x1="40" y1="24" x2="28" y2="6" />
          <line x1="72" y1="24" x2="84" y2="6" />
          <circle cx="28" cy="6" r="5.5" fill={bulb} strokeWidth="3" />
          <circle cx="84" cy="6" r="5.5" fill={bulb} strokeWidth="3" />
        </g>
      );
    case 'tv':
      return (
        <g stroke={LINE} strokeWidth="4" strokeLinecap="round">
          <line x1="56" y1="20" x2="40" y2="3" />
          <line x1="56" y1="20" x2="72" y2="3" />
          <circle cx="56" cy="19" r="4" fill={fill} strokeWidth="3" />
        </g>
      );
    case 'dino':
      return (
        <g fill={fill} {...stroke}>
          <path d="M28 24 L34 8 L42 22 Z" />
          <path d="M46 21 L54 4 L62 21 Z" />
          <path d="M66 22 L74 8 L82 24 Z" />
        </g>
      );
    default:
      return null;
  }
}

/** Pola badan sebagai `<pattern>` putih transparan di atas warna badan (D-102). */
function PatternDef({ id, kind }: { id: string; kind: MomoPattern }) {
  if (kind === 'none') return null;
  const ink = { fill: '#fff', fillOpacity: 0.42 };
  return (
    <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
      {kind === 'titik' && <circle cx="7" cy="7" r="2.6" {...ink} />}
      {kind === 'garis' && (
        <path
          d="M-2 4 L4 -2 M0 14 L14 0 M10 16 L16 10"
          stroke="#fff"
          strokeOpacity="0.45"
          strokeWidth="3"
        />
      )}
      {kind === 'bintang' && (
        <path
          d="M7 2 L8.5 5.6 L12.3 5.8 L9.3 8.2 L10.3 12 L7 9.9 L3.7 12 L4.7 8.2 L1.7 5.8 L5.5 5.6 Z"
          {...ink}
        />
      )}
      {kind === 'hati' && (
        <path
          d="M7 11.5 C2 8 2 4 4.5 3.5 C6 3.2 7 4.5 7 5.3 C7 4.5 8 3.2 9.5 3.5 C12 4 12 8 7 11.5 Z"
          {...ink}
        />
      )}
    </pattern>
  );
}

/** Pernak-pernik di wajah/badan, paling depan (D-102). */
function Extra({ kind, fill }: { kind: MomoExtra; fill: string }) {
  const stroke = { stroke: LINE, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'kacamata':
      return (
        <g fill="none" stroke={fill} strokeWidth="3.5">
          <circle cx="44" cy="50" r="10" />
          <circle cx="68" cy="50" r="10" />
          <path d="M54 50 h4 M34 48 L28 45 M78 48 L84 45" strokeLinecap="round" />
        </g>
      );
    case 'kacamata-hitam':
      return (
        <g {...stroke} strokeWidth="3">
          <rect x="32" y="42" width="22" height="15" rx="6" fill={fill} />
          <rect x="58" y="42" width="22" height="15" rx="6" fill={fill} />
          <path d="M54 48 h4" strokeWidth="3" />
          <path
            d="M36 46 l6 0"
            stroke="#fff"
            strokeOpacity="0.6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M62 46 l6 0"
            stroke="#fff"
            strokeOpacity="0.6"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    case 'dasi-kupu':
      return (
        <g fill={fill} {...stroke} strokeWidth="3">
          <path d="M56 90 L40 82 L40 98 Z" />
          <path d="M56 90 L72 82 L72 98 Z" />
          <circle cx="56" cy="90" r="4.5" />
        </g>
      );
    case 'syal':
      return (
        <g fill={fill} {...stroke} strokeWidth="3">
          <rect x="24" y="80" width="64" height="12" rx="6" />
          <path d="M68 88 L78 88 L80 112 L68 110 Z" />
        </g>
      );
    case 'headphone':
      return (
        <g {...stroke} strokeWidth="3">
          <path
            d="M12 54 C12 18 100 18 100 54"
            fill="none"
            stroke={LINE}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M12 54 C12 18 100 18 100 54"
            fill="none"
            stroke={fill}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect x="4" y="44" width="16" height="24" rx="7" fill={fill} />
          <rect x="92" y="44" width="16" height="24" rx="7" fill={fill} />
        </g>
      );
    case 'dasi':
      return (
        <g fill={fill} {...stroke} strokeWidth="2.5">
          <path d="M51 86 H61 L58 92 H54 Z" />
          <path d="M54 92 H58 L62 108 L56 114 L50 108 Z" />
        </g>
      );
    case 'medali':
      return (
        <g {...stroke} strokeWidth="2.5">
          <path d="M42 86 L52 100 L56 96 L48 86 Z" fill="#4f8ff7" />
          <path d="M70 86 L60 100 L56 96 L64 86 Z" fill="#ef6f6c" />
          <circle cx="56" cy="104" r="8" fill={fill} />
          <path
            d="M56 99.5 L57.4 102.6 L60.8 102.9 L58.2 105.1 L59 108.4 L56 106.6 L53 108.4 L53.8 105.1 L51.2 102.9 L54.6 102.6 Z"
            fill="#fff"
            fillOpacity="0.8"
            stroke="none"
          />
        </g>
      );
    case 'pipi-bintang':
      return (
        <g fill={fill} {...stroke} strokeWidth="2">
          <path d="M36 58 L38 62.5 L43 63 L39.2 66 L40.4 71 L36 68.4 L31.6 71 L32.8 66 L29 63 L34 62.5 Z" />
          <path d="M76 58 L78 62.5 L83 63 L79.2 66 L80.4 71 L76 68.4 L71.6 71 L72.8 66 L69 63 L74 62.5 Z" />
        </g>
      );
    default:
      return null;
  }
}

/** Lapisan di belakang layar wajah (jilbab membingkai wajah). */
function AccessoryBack({ kind, fill }: { kind: MomoAccessory; fill: string }) {
  if (kind !== 'jilbab') return null;
  return (
    <path
      d="M56 8 C26 8 9 30 9 56 L9 90 C30 98 82 98 103 90 L103 56 C103 30 86 8 56 8 Z"
      fill={fill}
      stroke={LINE}
      strokeWidth="4"
      strokeLinejoin="round"
    />
  );
}

/** Lapisan di depan (rambut, topi, peci, pita) dan kain jilbab di dada. */
function AccessoryFront({ kind, fill }: { kind: MomoAccessory; fill: string }) {
  const stroke = { stroke: LINE, strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'rambut-poni':
      return (
        <path
          d="M16 44 C14 22 32 13 56 13 C80 13 98 22 96 44 L90 36 L83 43 L76 34 L68 42 L60 33 L52 42 L44 34 L36 43 L29 34 L22 43 Z"
          fill={fill}
          {...stroke}
        />
      );
    case 'rambut-kuncir':
      return (
        <g fill={fill} {...stroke}>
          <circle cx="9" cy="42" r="9" />
          <circle cx="103" cy="42" r="9" />
          <path d="M16 40 C16 20 34 14 56 14 C78 14 96 20 96 40 C82 30 30 30 16 40 Z" />
          <circle cx="17" cy="38" r="3.5" fill="#f58fc0" />
          <circle cx="95" cy="38" r="3.5" fill="#f58fc0" />
        </g>
      );
    case 'rambut-keriting':
      return (
        <g fill={fill} {...stroke}>
          {[22, 34, 46, 58, 70, 82, 90].map((x, i) => (
            <circle key={x} cx={x} cy={i % 2 ? 18 : 22} r="10" />
          ))}
          <circle cx="16" cy="34" r="8" />
          <circle cx="96" cy="34" r="8" />
        </g>
      );
    case 'topi':
      return (
        <g {...stroke}>
          <path d="M18 34 C18 10 94 10 94 34 Z" fill={fill} />
          <rect x="52" y="29" width="54" height="8" rx="4" fill={fill} />
          <circle cx="56" cy="13" r="4" fill={fill} />
        </g>
      );
    case 'peci':
      return <path d="M22 28 L27 9 H85 L90 28 Z" fill={fill} {...stroke} />;
    case 'jilbab':
      return (
        <path
          d="M28 86 Q56 102 84 86 L86 96 Q56 116 26 96 Z"
          fill={fill}
          stroke={LINE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      );
    case 'pita':
      return (
        <g fill={fill} {...stroke}>
          <path d="M80 22 L66 12 L66 32 Z" />
          <path d="M80 22 L94 12 L94 32 Z" />
          <circle cx="80" cy="22" r="5" />
        </g>
      );
    case 'rambut-cepak':
      return (
        <g fill={fill} {...stroke}>
          <path d="M17 38 C16 18 34 12 56 12 C78 12 96 18 95 38 C82 28 30 28 17 38 Z" />
          <path
            d="M30 22 l3 -3 M42 18 l3 -3 M56 17 l3 -3 M70 18 l3 -3 M82 22 l3 -3"
            stroke="#fff"
            strokeOpacity="0.35"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    case 'rambut-jabrik':
      return (
        <path
          d="M15 42 L17 24 L25 30 L28 9 L39 23 L46 3 L56 20 L66 3 L73 23 L84 9 L87 30 L95 24 L97 42 C82 30 30 30 15 42 Z"
          fill={fill}
          {...stroke}
        />
      );
    case 'rambut-belah':
      return (
        <g fill={fill} {...stroke}>
          <path d="M15 44 C12 20 32 10 58 10 C84 10 100 22 97 42 C90 30 72 25 50 29 C38 31 26 36 15 44 Z" />
          <path
            d="M40 13 C44 19 47 24 49 29"
            fill="none"
            stroke={LINE}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      );
    case 'rambut-mohawk':
      return (
        <g fill={fill} {...stroke}>
          <path
            d="M18 34 C22 24 34 20 44 20 L68 20 C78 20 90 24 94 34 C80 28 32 28 18 34 Z"
            fillOpacity="0.55"
          />
          <path d="M42 26 L44 6 L50 15 L56 0 L62 15 L68 6 L70 26 Z" />
        </g>
      );
    case 'rambut-gelombang':
      return (
        <path
          d="M13 58 C6 30 26 9 56 9 C86 9 106 30 99 58 C95 50 94 42 88 36 C82 40 76 34 70 37 C64 31 56 36 50 32 C44 37 36 31 30 36 C24 33 20 42 13 58 Z"
          fill={fill}
          {...stroke}
        />
      );
    case 'topi-terbalik':
      return (
        <g fill={fill} {...stroke}>
          <path d="M4 33 C4 27 10 26 20 27 L22 36 C12 37 4 37 4 33 Z" />
          <path d="M18 35 C18 9 94 9 94 35 Z" />
          <rect x="66" y="27" width="16" height="6" rx="3" fill="#fff8ec" />
          <circle cx="56" cy="12" r="4" />
        </g>
      );
    case 'bandana':
      return (
        <g fill={fill} {...stroke}>
          <path d="M16 31 C40 22 72 22 96 31 L96 40 C72 31 40 31 16 40 Z" />
          <path d="M95 33 L108 26 L106 39 Z" />
          <path d="M95 36 L105 46 L98 48 Z" />
          <circle cx="40" cy="31" r="1.8" fill="#fff" stroke="none" />
          <circle cx="56" cy="29" r="1.8" fill="#fff" stroke="none" />
          <circle cx="72" cy="31" r="1.8" fill="#fff" stroke="none" />
        </g>
      );
    case 'mahkota':
      return (
        <g {...stroke}>
          <path d="M30 26 L32 6 L44 16 L56 2 L68 16 L80 6 L82 26 Z" fill={fill} />
          <circle cx="56" cy="16" r="3.5" fill="#ef6f6c" />
          <circle cx="40" cy="20" r="2.5" fill="#4f8ff7" />
          <circle cx="72" cy="20" r="2.5" fill="#46b97a" />
        </g>
      );
    case 'bunga':
      return (
        <g {...stroke}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx={82 + 8 * Math.cos((a * Math.PI) / 180)}
              cy={20 + 8 * Math.sin((a * Math.PI) / 180)}
              r="6"
              fill={fill}
            />
          ))}
          <circle cx="82" cy="20" r="5" fill="#f7c948" />
        </g>
      );
    default:
      return null;
  }
}

/**
 * Momo, robot kecil. Placeholder SVG — antarmuka `mood` disiapkan agar bisa diganti animasi Rive
 * (PRD A3) tanpa mengubah pemakaian.
 */
export function Momo({
  mood: moodProp = 'idle',
  // Bawaan Momo UdaKids berbadan merah gonjong (D-113); Momo milik anak selalu memakai warna pilihannya.
  color = 'merah',
  size = 160,
  label,
  look,
  own = false,
}: {
  mood?: MomoMood;
  color?: Color;
  size?: number;
  label?: string;
  /** Gradasi & aksesori (D-051). */
  look?: MomoLook | null;
  /** Momo milik anak yang sedang bermain: tampilan diambil dari `OwnMomoLook`. */
  own?: boolean;
}) {
  // Suasana lama dipetakan: neutral jadi idle, encourage jadi curious.
  const mood: Exclude<MomoMood, 'neutral' | 'encourage'> =
    moodProp === 'neutral' ? 'idle' : moodProp === 'encourage' ? 'curious' : moodProp;
  const ownLook = useContext(OwnLook);
  const style = look !== undefined ? look : own ? ownLook : null;
  const uid = useId().replace(/:/g, '');
  const gid = `momo-g${uid}`;
  const pid = `momo-p${uid}`;
  const ukModel = (style?.model ?? DEFAULT_MOMO_MODEL) === 'udakids';
  // Merah Momo UdaKids = merah gonjong merek (D-113); warna lain tetap palet Momo.
  const base =
    momoHex(style?.body) ?? (ukModel && color === 'merah' ? '#c8321f' : BODY[color]) ?? '#8a6cf0';
  const second = momoHex(style?.gradient);
  const body = second ? `url(#${gid})` : base;
  const model: MomoModel = style?.model ?? DEFAULT_MOMO_MODEL;
  const uk = model === 'udakids';
  // Momo UdaKids: kepala putih, layar wajah gelap, mata & mulut cyan (D-113). Warna pilihan anak di badan.
  const headFill = uk ? '#ffffff' : body;
  const screenFill = uk ? '#1c2430' : '#fff8ec';
  const ink = uk ? '#7fe0ff' : '#1d1a2e';
  const head = HEAD[model] ?? HEAD.kotak;
  const pattern: MomoPattern = style?.pattern ?? 'none';
  const accessory: MomoAccessory = style?.accessory ?? 'none';
  const accFill =
    momoHex(style?.accessoryColor) ?? MOMO_TONES[ACCESSORY_DEFAULT_TONE[accessory] ?? 'hitam'];
  const extra: MomoExtra = style?.extra ?? 'none';
  const extraFill = momoHex(style?.extraColor) ?? MOMO_TONES[EXTRA_DEFAULT_TONE[extra] ?? 'hitam'];
  // Antena tunggal hanya untuk model kotak & bulat; model lain punya telinga/antena sendiri.
  const antenna = !HIDES_ANTENNA.has(accessory) && (model === 'kotak' || model === 'bulat');
  const backTop =
    accessory !== 'jilbab' &&
    !(HIDES_ANTENNA.has(accessory) && (model === 'alien' || model === 'tv' || uk));
  const eyes =
    mood === 'happy' || mood === 'proud' ? (
      <>
        <path
          d="M38 50 q6 -8 12 0"
          stroke={ink}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M62 50 q6 -8 12 0"
          stroke={ink}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ) : mood === 'sleepy' ? (
      <>
        <path d="M38 50 h12" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M62 50 h12" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="44" cy="50" r={mood === 'oops' ? 7 : 6} fill={ink} />
        <circle cx="68" cy="50" r={mood === 'oops' ? 7 : 6} fill={ink} />
        <circle cx="46" cy="48" r="2" fill="#fff" />
        <circle cx="70" cy="48" r="2" fill="#fff" />
      </>
    );
  const mouth =
    mood === 'oops' ? (
      <ellipse cx="56" cy="66" rx="6" ry="5" fill={ink} />
    ) : mood === 'curious' ? (
      <path d="M48 66 q8 4 16 -2" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
    ) : mood === 'sleepy' || mood === 'idle' ? (
      <path d="M48 66 q8 5 16 0" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M44 62 q12 14 24 0 z" fill={ink} />
    );
  return (
    <svg
      className={`momo momo-${mood}`}
      width={size}
      height={size * 1.15}
      viewBox="0 0 112 128"
      role="img"
      aria-label={label ?? 'Momo'}
    >
      {(second || pattern !== 'none') && (
        <defs>
          {second && (
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={base} />
              <stop offset="100%" stopColor={second} />
            </linearGradient>
          )}
          <PatternDef id={pid} kind={pattern} />
        </defs>
      )}
      {backTop && <ModelBack model={model} fill={body} mood={mood} />}
      {antenna && (
        <>
          <line
            className="momo-antenna"
            x1="56"
            y1="6"
            x2="56"
            y2="20"
            stroke="#2b2540"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle
            cx="56"
            cy="6"
            r="6"
            fill={mood === 'proud' ? '#f7c948' : '#ffe08a'}
            stroke="#2b2540"
            strokeWidth="3"
          />
        </>
      )}
      <rect
        x={head.x}
        y={head.y}
        width={head.w}
        height={head.h}
        rx={head.rx}
        fill={headFill}
        stroke="#2b2540"
        strokeWidth="4"
      />
      {pattern !== 'none' && !uk && (
        <rect
          className="momo-pattern"
          x={head.x + 2}
          y={head.y + 2}
          width={head.w - 4}
          height={head.h - 4}
          rx={Math.max(0, head.rx - 2)}
          fill={`url(#${pid})`}
        />
      )}
      <AccessoryBack kind={accessory} fill={accFill} />
      <rect
        x="28"
        y="34"
        width="56"
        height="42"
        rx="16"
        fill={screenFill}
        stroke="#2b2540"
        strokeWidth="3"
      />
      {eyes}
      {mouth}
      {(mood === 'happy' || mood === 'proud') && (
        <>
          <circle cx="36" cy="64" r="4" fill="#ffb3b0" />
          <circle cx="76" cy="64" r="4" fill="#ffb3b0" />
        </>
      )}
      <rect
        x={BODY_BOX.x}
        y={BODY_BOX.y}
        width={BODY_BOX.w}
        height={BODY_BOX.h}
        rx={model === 'bulat' ? 15 : BODY_BOX.rx}
        fill={body}
        stroke="#2b2540"
        strokeWidth="4"
      />
      {pattern !== 'none' && (
        <rect
          x={BODY_BOX.x + 2}
          y={BODY_BOX.y + 2}
          width={BODY_BOX.w - 4}
          height={BODY_BOX.h - 4}
          rx={BODY_BOX.rx - 2}
          fill={`url(#${pid})`}
        />
      )}
      <path
        d={mood === 'happy' || mood === 'proud' ? 'M30 92 l-16 -18' : 'M30 96 l-14 10'}
        stroke="#2b2540"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={
          mood === 'happy' || mood === 'proud'
            ? 'M82 92 l16 -18'
            : mood === 'curious'
              ? 'M82 94 l14 -12'
              : 'M82 96 l14 10'
        }
        stroke="#2b2540"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {uk ? (
        // Garis pucuk rebung di dada (D-113).
        <path
          className="momo-rebung"
          d="M37 106 L43.5 98 L50 106 L56.5 98 L63 106 L69.5 98 L75 105"
          fill="none"
          stroke="#f5b301"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <circle cx="56" cy="101" r="5" fill="#fff8ec" stroke="#2b2540" strokeWidth="2" />
      )}
      <AccessoryFront kind={accessory} fill={accFill} />
      <Extra kind={extra} fill={extraFill} />
    </svg>
  );
}
