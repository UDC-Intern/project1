/** Hiasan SVG sederhana untuk landing dan halaman masuk. Semua bersifat dekoratif (aria-hidden). */

export function Cloud({ className = '', width = 120 }: { className?: string; width?: number }) {
  return (
    <svg
      className={`decor ${className}`}
      width={width}
      viewBox="0 0 120 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 56a20 20 0 0 1 2-40 26 26 0 0 1 50-4 22 22 0 0 1 20 44z"
        fill="var(--kertas)"
        stroke="var(--garis-tegas)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Star({ className = '', size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      className={`decor ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
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

/** Tunas kecil, mengingatkan pada tanaman Skor Jago. */
export function Sprout({ className = '', size = 56 }: { className?: string; size?: number }) {
  return (
    <svg
      className={`decor ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 44V22" stroke="var(--sawah)" strokeWidth="4" strokeLinecap="round" />
      <path d="M24 28C14 28 10 20 10 12c10 0 14 6 14 16z" fill="var(--sawah)" />
      <path d="M24 24c0-8 4-14 14-14 0 8-4 14-14 14z" fill="var(--sawah-tekan)" />
    </svg>
  );
}

/** Kartu perintah berwarna, hiasan latar. */
export function Block({
  color = 'var(--gonjong)',
  size = 44,
  className = '',
}: {
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`decor ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="40" height="40" rx="10" fill={color} />
      <path
        d="M14 24h20M26 15l9 9-9 9"
        stroke="#fff"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
