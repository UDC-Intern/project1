import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

/** Kartu besar. Bila ada onClick jadi tombol, dan tetap bisa dioperasikan dengan mouse atau keyboard. */
export function BigCard({ children, onClick, disabled }: Props) {
  if (!onClick) return <div className="uk-card uk-card--big">{children}</div>;
  return (
    <button
      type="button"
      className="uk-card uk-card--big"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
    >
      {children}
    </button>
  );
}
