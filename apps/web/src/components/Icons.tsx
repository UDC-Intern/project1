import type { ReactNode } from 'react';

type IconProps = { size?: number; title?: string };

function Svg({ size = 24, title, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {children}
    </svg>
  );
}

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 19V5" />
  </Svg>
);
export const TrophyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M12 13v4M8 20h8M8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3" />
  </Svg>
);
export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
export const SpeakerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M17 9a4 4 0 0 1 0 6" />
  </Svg>
);
export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 13l4 4L19 7" />
  </Svg>
);
export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const DoorIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" />
    <path d="M3 21h18M12 12h.01" />
  </Svg>
);
export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4l13 8-13 8z" fill="currentColor" />
  </Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
/** Medali berpita: tanda Sertifikat Juara Digital. */
export const MedalIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="6" />
    <path d="M8.5 14L7 21l5-2.5 5 2.5-1.5-7" />
    <path d="M12 6.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" />
  </Svg>
);
export const PrintIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 9V3h10v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </Svg>
);

/** Bintang isi untuk poin: kunyit, dengan garis supaya tetap terlihat di latar terang. */
export function StarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
        fill="var(--kunyit)"
        stroke="var(--kunyit-tekan)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mahkota untuk juara pertama di podium. */
export function CrownIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5z"
        fill="var(--kunyit)"
        stroke="var(--kunyit-tekan)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15" r="1.4" fill="var(--kunyit-tekan)" />
    </svg>
  );
}
