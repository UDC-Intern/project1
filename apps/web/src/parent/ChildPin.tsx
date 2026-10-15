import { samePin, type Pin, type PinPicture } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { overview, setPin } from '../api/parent';
import { PicturePin } from '../components/PicturePin';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

/** Atur sandi gambar: pilih 3 gambar, lalu ulangi untuk memastikan. */
export function ChildPin() {
  const t = useT('parent');
  const { id = '' } = useParams();
  const load = useCallback(() => overview(), []);
  const { data, error: loadError, loading, reload } = useAsync(load);

  const [first, setFirst] = useState<Pin | null>(null);
  const [current, setCurrent] = useState<PinPicture[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (loading) return <LoadingState />;
  const child = data?.children.find((c) => c.id === id);
  if (loadError || !data || !child) return <ErrorState onRetry={reload} />;

  async function onChange(next: PinPicture[]) {
    setCurrent(next);
    if (next.length !== 3) return;
    const pin: Pin = [next[0]!, next[1]!, next[2]!];
    if (!first) {
      setFirst(pin);
      setCurrent([]);
      setMessage(null);
      return;
    }
    if (!samePin(first, pin)) {
      setFirst(null);
      setCurrent([]);
      setMessage(t('pin.mismatch'));
      return;
    }
    try {
      await setPin(id, pin);
      setDone(true);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
      setFirst(null);
      setCurrent([]);
    }
  }

  return (
    <div className="uk-stack" style={{ maxWidth: 480 }}>
      <h1>{t('pin.title', { nickname: child.nickname })}</h1>
      {done ? (
        <>
          <p role="status" className="uk-note-ok">
            {t('pin.done')}
          </p>
          <Link className="uk-btn" to="/orang-tua">
            {t('pin.back')}
          </Link>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>{first ? t('pin.step2') : t('pin.step1')}</p>
          {message && (
            <p role="alert" style={{ margin: 0 }}>
              {message}
            </p>
          )}
          <PicturePin value={current} onChange={(n) => void onChange(n)} />
        </>
      )}
    </div>
  );
}
