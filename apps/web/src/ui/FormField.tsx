import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null };

/** Isian dengan label. Pesan galat dibacakan pembaca layar lewat aria-describedby. */
export function FormField({ label, error, id, ...rest }: Props) {
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label className="uk-field" htmlFor={fieldId}>
      {label}
      <input id={fieldId} aria-invalid={error ? true : undefined} {...rest} />
      {error && (
        <span role="alert" style={{ color: 'var(--bahaya)', fontWeight: 400 }}>
          {error}
        </span>
      )}
    </label>
  );
}
