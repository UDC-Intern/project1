import type { ReactNode } from 'react';
import { useT } from '../i18n';

export function LoadingState() {
  const t = useT();
  return (
    <div className="uk-stack" role="status" aria-live="polite">
      <div className="uk-skeleton" style={{ height: 32, width: '60%' }} />
      <div className="uk-skeleton" style={{ height: 96 }} />
      <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>
        {t('loading')}
      </span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="uk-empty">
      <h2>{title ?? t('empty.title')}</h2>
      <p>{hint ?? t('empty.hint')}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="uk-error" role="alert">
      <h2>{t('error.title')}</h2>
      <p>{message ?? t('error.hint')}</p>
      {onRetry && (
        <button type="button" className="uk-btn" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
