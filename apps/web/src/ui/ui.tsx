import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../i18n';
import { ListPager, usePaged } from './Pager';
import './ui.css';

/** Komponen dasar untuk area orang dewasa (admin, fasilitator, orang tua). */

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** `sm`: tombol ringkas untuk aksi di baris tabel dan kartu. */
  size?: 'md' | 'sm';
}) {
  return (
    <button
      type="button"
      {...props}
      className={`ui-btn ui-btn-${variant}${size === 'sm' ? ' ui-btn-sm' : ''} ${className ?? ''}`}
    />
  );
}

type FieldProps = { label: string; hint?: string; error?: string };

/**
 * Label + tanda wajib. Tanda "*" di luar <label> (aria-hidden) agar nama aksesibel tetap bersih;
 * status wajib diumumkan pembaca layar lewat atribut `required` / `aria-required` pada input.
 */
function FieldLabel({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <div className="ui-label-row">
      <label htmlFor={id}>{label}</label>
      {required && (
        <span className="ui-req" aria-hidden>
          *
        </span>
      )}
    </div>
  );
}

/** Keterangan di atas formulir: "* wajib diisi". */
export function RequiredNote() {
  return (
    <p className="ui-req-note">
      <span className="ui-req" aria-hidden>
        *
      </span>{' '}
      {t('common.required')}
    </p>
  );
}

const describedBy = (id: string, hint?: string, error?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextField({
  label,
  hint,
  error,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="ui-field">
      <FieldLabel id={id} label={label} required={props.required} />
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-required={props.required || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
      {hint && !error && (
        <small id={`${id}-hint`} className="ui-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="ui-error">
          {error}
        </small>
      )}
    </div>
  );
}

/** Kolom password dengan tombol tampilkan/sembunyikan (tetap bisa keyboard & mouse). */
export function PasswordField({
  label,
  hint,
  error,
  ...props
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="ui-field">
      <FieldLabel id={id} label={label} required={props.required} />
      <div className="ui-input-wrap">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-required={props.required || undefined}
          aria-describedby={describedBy(id, hint, error)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...props}
        />
        <button
          type="button"
          className="ui-eye"
          aria-controls={id}
          aria-pressed={shown}
          aria-label={shown ? t('common.password.hide') : t('common.password.show')}
          title={shown ? t('common.password.hide') : t('common.password.show')}
          onClick={() => setShown((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
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
            {shown ? t('common.password.hideShort') : t('common.password.showShort')}
          </span>
        </button>
      </div>
      {hint && !error && (
        <small id={`${id}-hint`} className="ui-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="ui-error">
          {error}
        </small>
      )}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  error,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} aria-invalid={error ? true : undefined} {...props} />
      {hint && !error && <small className="ui-hint">{hint}</small>}
      {error && <small className="ui-error">{error}</small>}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  options,
  ...props
}: FieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && !error && <small className="ui-hint">{hint}</small>}
      {error && <small className="ui-error">{error}</small>}
    </div>
  );
}

export function Checkbox({
  label,
  ...props
}: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="ui-check-row">
      <label className="ui-check">
        <input type="checkbox" aria-required={props.required || undefined} {...props} />
        <span>{label}</span>
      </label>
      {props.required && (
        <span className="ui-req" aria-hidden>
          *
        </span>
      )}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ui-card ${className ?? ''}`}>
      {(title || actions) && (
        <header className="ui-card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="ui-row">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ui-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="ui-muted">{subtitle}</p>}
      </div>
      {actions && <div className="ui-row">{actions}</div>}
    </header>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  return (
    <div className={`ui-notice ui-notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/**
 * Pop-up modal (elemen `<dialog>` bawaan: fokus terkunci di dalam, Esc menutup, latar diredupkan).
 * Peramban tanpa `showModal` tetap menampilkannya sebagai kotak biasa.
 */
export function Dialog({
  open,
  title,
  children,
  actions,
  onClose,
  tone = 'info',
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  tone?: 'info' | 'warning';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`ui-dialog ui-dialog-${tone}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Ketuk di luar kotak (latar) menutup pop-up.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="ui-dialog-box">
          <h2 id={titleId}>{title}</h2>
          <div className="ui-dialog-body">{children}</div>
          <div className="ui-dialog-actions">{actions}</div>
        </div>
      )}
    </dialog>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info' | 'muted' | 'danger';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="ui-spinner" role="status">
      <span className="ui-spinner-dot" aria-hidden />
      {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="ui-empty">{children}</p>;
}

export type Column<T> = {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  width?: string;
};

/** Tabel sederhana. Dengan `pageSize`, baris dibagi per halaman dan pager tampil di bawahnya. */
export function Table<T>({
  rows,
  columns,
  rowKey,
  empty,
  pageSize,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  pageSize?: number;
}) {
  const paged = usePaged(rows, pageSize ?? Number.POSITIVE_INFINITY);
  if (rows.length === 0) return <Empty>{empty ?? t('common.empty')}</Empty>;
  return (
    <>
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.items.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize !== undefined && <ListPager paged={paged} />}
    </>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="ui-stat">
      <span className="ui-stat-value">{value}</span>
      <span className="ui-stat-label">{label}</span>
      {hint && <small className="ui-muted">{hint}</small>}
    </div>
  );
}

export const formatDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
