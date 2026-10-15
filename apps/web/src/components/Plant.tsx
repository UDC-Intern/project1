import type { Stage } from '@udakids/engine';

const LABELS: Record<Stage, string> = {
  0: 'Benih',
  1: 'Tunas',
  2: 'Pohon',
  3: 'Pohon berbuah',
};

/** Tanaman 4 tahap. Anak hanya melihat tahap ini, tidak pernah angka Skor Jago. */
export function Plant({ stage, size = 96 }: { stage: Stage; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={LABELS[stage]}>
      <ellipse cx="50" cy="88" rx="30" ry="7" fill="#e7dcc8" />
      {stage === 0 && <ellipse cx="50" cy="80" rx="9" ry="6" fill="#8a6a3c" />}
      {stage >= 1 && (
        <>
          <path d="M50 84 V54" stroke="#2f9e63" strokeWidth="5" strokeLinecap="round" />
          <path d="M50 62 Q34 58 32 44 Q46 46 50 62Z" fill="#3fa66b" />
          <path d="M50 54 Q66 50 68 36 Q54 38 50 54Z" fill="#2f9e63" />
        </>
      )}
      {stage >= 2 && (
        <>
          <path d="M50 54 V30" stroke="#8a6a3c" strokeWidth="7" strokeLinecap="round" />
          <circle cx="50" cy="26" r="20" fill="#3fa66b" />
          <circle cx="36" cy="36" r="13" fill="#2f9e63" />
          <circle cx="64" cy="36" r="13" fill="#2f9e63" />
        </>
      )}
      {stage === 3 && (
        <>
          <circle cx="42" cy="22" r="4.5" fill="#f2b705" />
          <circle cx="58" cy="28" r="4.5" fill="#f2b705" />
          <circle cx="36" cy="38" r="4.5" fill="#f2b705" />
          <circle cx="64" cy="42" r="4.5" fill="#f2b705" />
        </>
      )}
    </svg>
  );
}
