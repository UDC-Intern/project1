import type { MomoColor } from '@udakids/engine';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { deleteChild, overview, updateChild } from '../api/parent';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ColorPicker } from '../ui/ColorPicker';
import { FormField } from '../ui/FormField';
import { ErrorState, LoadingState } from '../ui/states';

export function EditChild() {
  const t = useT('parent');
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const load = useCallback(() => overview(), []);
  const { data, error: loadError, loading, reload } = useAsync(load);
  const child = data?.children.find((c) => c.id === id);

  const [nickname, setNickname] = useState('');
  const [momoColor, setMomoColor] = useState<MomoColor>('blue');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (child) {
      setNickname(child.nickname);
      setMomoColor(child.momoColor);
    }
  }, [child]);

  if (loading) return <LoadingState />;
  if (loadError || !data) return <ErrorState onRetry={reload} />;
  if (!child) return <ErrorState message={t('error.generic')} />;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await updateChild(id, { nickname, momoColor });
      setMessage(t('edit.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  async function remove() {
    try {
      await deleteChild(id);
      navigate('/orang-tua', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  return (
    <div className="uk-stack" style={{ maxWidth: 480 }}>
      <h1>{t('edit.title')}</h1>
      <form className="uk-stack" onSubmit={(e) => void save(e)} noValidate>
        <FormField
          label={t('add.nickname')}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          autoComplete="off"
          error={error}
        />
        <div className="uk-stack">
          <strong>{t('add.color')}</strong>
          <ColorPicker value={momoColor} onChange={setMomoColor} />
        </div>
        <button type="submit" className="uk-btn" disabled={nickname.trim().length < 2}>
          {t('edit.save')}
        </button>
        {message && (
          <p role="status" className="uk-note-ok" style={{ margin: 0 }}>
            {message}
          </p>
        )}
      </form>

      <section className="uk-card uk-stack">
        <h2>{t('edit.deleteTitle')}</h2>
        <p style={{ margin: 0 }}>{t('edit.deleteHint', { nickname: child.nickname })}</p>
        <FormField
          label={child.nickname}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="uk-btn uk-btn--danger"
          disabled={confirm !== child.nickname}
          onClick={() => void remove()}
        >
          {t('edit.delete')}
        </button>
      </section>
    </div>
  );
}
