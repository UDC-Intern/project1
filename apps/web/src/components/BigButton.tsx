import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'play';
};

/** Tombol area anak: berbentuk anak tangga, tinggi dan lebar minimal 64 px. */
export function BigButton({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const cls = [
    'kid-btn',
    variant === 'ghost' ? 'secondary' : '',
    variant === 'play' ? 'big-play' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
