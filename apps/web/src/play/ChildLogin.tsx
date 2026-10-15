import type { PinPicture } from '@udakids/engine';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { childLogin, familyProfiles } from '../api/auth';
import { ApiError } from '../api/client';
import { useSession } from '../auth/store';
import { BigButton } from '../components/BigButton';
import { BigCard } from '../components/BigCard';
import { Momo } from '../components/Momo';
import { PicturePin } from '../components/PicturePin';
import { useT } from '../i18n';

type Profile = Awaited<ReturnType<typeof familyProfiles>>['profiles'][number];
const CODE_LENGTH = 6;

export function ChildLogin() {
  const t = useT('play');
  const navigate = useNavigate();
  const session = useSession((s) => s.session);
  const signIn = useSession((s) => s.signIn);

  const [code, setCode] = useState('');
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [chosen, setChosen] = useState<Profile | null>(null);
  const [pin, setPin] = useState<PinPicture[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session?.role === 'child') return <Navigate to="/play" replace />;

  const explain = (err: unknown): string => {
    if (!(err instanceof ApiError)) return t('error.generic');
    if (err.body.code === 'TEMPORARILY_LOCKED') {
      const ms = err.body.lockedUntil ? Date.parse(err.body.lockedUntil) - Date.now() : 60_000;
      return t('error.TEMPORARILY_LOCKED', { minutes: Math.max(1, Math.ceil(ms / 60_000)) });
    }
    if (err.body.code === 'WRONG_PIN' || err.body.code === 'NOT_FOUND')
      return t(`error.${err.body.code}`);
    return t('error.generic');
  };

  async function findFamily() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await familyProfiles(code);
      setProfiles(res.profiles);
    } catch (err) {
      setMessage(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitPin(next: PinPicture[]) {
    if (!chosen || next.length !== 3) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await childLogin({
        childId: chosen.id,
        pin: [next[0]!, next[1]!, next[2]!],
      });
      signIn({ token: res.token, role: 'child', name: res.child.nickname });
      navigate('/play', { replace: true });
    } catch (err) {
      setMessage(explain(err));
      setPin([]);
    } finally {
      setBusy(false);
    }
  }

  const onPinChange = (next: PinPicture[]) => {
    setPin(next);
    if (next.length === 3) void submitPin(next);
  };

  return (
    <main className="uk-child-main" style={{ minHeight: '100vh' }}>
      <div className="uk-row" style={{ marginBottom: 'var(--uk-space-4)' }}>
        <Momo mood={message ? 'encourage' : 'happy'} size={80} />
        <h1 style={{ margin: 0 }}>{t('login.title')}</h1>
      </div>

      {message && (
        <div className="uk-feedback uk-feedback--retry" role="alert" aria-live="polite">
          {message}
        </div>
      )}

      {!profiles && (
        <form
          className="uk-stack"
          style={{ marginTop: 'var(--uk-space-4)' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === CODE_LENGTH) void findFamily();
          }}
        >
          <label className="uk-field" style={{ fontSize: 'var(--uk-text-child)' }}>
            {t('login.code.label')}
            <input
              value={code}
              maxLength={CODE_LENGTH}
              autoComplete="off"
              autoCapitalize="characters"
              inputMode="text"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              style={{
                minHeight: 'var(--uk-touch)',
                fontSize: 'var(--uk-text-question)',
                letterSpacing: '0.2em',
                textAlign: 'center',
              }}
            />
          </label>
          <p style={{ margin: 0 }}>{t('login.code.hint')}</p>
          <BigButton type="submit" disabled={code.length !== CODE_LENGTH || busy}>
            {busy ? t('login.checking') : t('login.next')}
          </BigButton>
        </form>
      )}

      {profiles && !chosen && (
        <div className="uk-stack" style={{ marginTop: 'var(--uk-space-4)' }}>
          <h2>{t('login.who')}</h2>
          <div className="uk-grid">
            {profiles.map((p) => (
              <BigCard key={p.id} onClick={() => setChosen(p)} disabled={!p.hasPin}>
                <div className="uk-row">
                  <Momo color={p.momoColor} size={56} />
                  <strong>{p.nickname}</strong>
                </div>
                {!p.hasPin && <p style={{ margin: 0 }}>{t('login.nopin')}</p>}
              </BigCard>
            ))}
          </div>
          <BigButton variant="ghost" onClick={() => setProfiles(null)}>
            {t('login.change')}
          </BigButton>
        </div>
      )}

      {chosen && (
        <div className="uk-stack" style={{ marginTop: 'var(--uk-space-4)' }}>
          <div className="uk-row">
            <Momo color={chosen.momoColor} size={64} />
            <strong>{chosen.nickname}</strong>
          </div>
          <PicturePin value={pin} onChange={onPinChange} />
          <BigButton
            variant="ghost"
            onClick={() => {
              setChosen(null);
              setPin([]);
              setMessage(null);
            }}
          >
            {t('login.change')}
          </BigButton>
        </div>
      )}
    </main>
  );
}
