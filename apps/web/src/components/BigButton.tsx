import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

/** Tombol area anak: tinggi dan lebar minimal 64 px (aturan UX anak). */
export function BigButton({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const cls = ['uk-btn', 'uk-btn--big', variant === 'ghost' ? 'uk-btn--ghost' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
