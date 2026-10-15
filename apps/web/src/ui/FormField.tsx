import { useState, type InputHTMLAttributes } from 'react';
import { useT } from '../i18n';

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

type PasswordProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string | null;
};

/** Isian password dengan tombol Lihat/Tutup di dalam kolom; bisa dipakai lewat papan ketik dan pointer. */
export function PasswordField({ label, error, id, ...rest }: PasswordProps) {
  const t = useT('common');
  const [shown, setShown] = useState(false);
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const caption = shown ? t('password.hide') : t('password.show');
  return (
    <div className="uk-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="ui-input-wrap">
        <input
          id={fieldId}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...rest}
        />
        <button
          type="button"
          className="ui-eye"
          aria-controls={fieldId}
          aria-pressed={shown}
          aria-label={caption}
          title={caption}
          onClick={() => setShown((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
            {shown && (
              <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            )}
          </svg>
          <span className="ui-eye-text">
            {shown ? t('password.hideShort') : t('password.showShort')}
          </span>
        </button>
      </div>
      {error && (
        <span role="alert" style={{ color: 'var(--bahaya)', fontWeight: 400 }}>
          {error}
        </span>
      )}
    </div>
  );
}
