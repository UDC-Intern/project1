import type { PinPicture } from '@udakids/engine';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { childLogin, familyProfiles } from '../api/auth';
import { ApiError } from '../api/client';
import { useSession } from '../auth/store';
import { BigButton } from '../components/BigButton';
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
  const [shake, setShake] = useState(false);
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
      const res = await childLogin({ childId: chosen.id, pin: [next[0]!, next[1]!, next[2]!] });
      signIn({ token: res.token, role: 'child', name: res.child.nickname });
      navigate('/play', { replace: true });
    } catch (err) {
      setMessage(explain(err));
      setPin([]);
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  }

  const onPinChange = (next: PinPicture[]) => {
    setPin(next);
    if (next.length === 3) void submitPin(next);
  };

  return (
    <main className="kid-screen">
      <Momo mood={message ? 'encourage' : 'happy'} size={120} />
      <h1 className="kid-say" style={{ margin: 0 }}>
        {t('login.title')}
      </h1>

      {message && (
        <p className="kid-note" role="alert">
          {message}
        </p>
      )}

      {!profiles && (
        <form
          className="code-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === CODE_LENGTH) void findFamily();
          }}
        >
          <label htmlFor="family-code">{t('login.code.label')}</label>
          <input
            id="family-code"
            value={code}
            maxLength={CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <p style={{ margin: 0 }}>{t('login.code.hint')}</p>
          <BigButton type="submit" variant="play" disabled={code.length !== CODE_LENGTH || busy}>
            {busy ? t('login.checking') : t('login.next')}
          </BigButton>
        </form>
      )}

      {profiles && !chosen && (
        <>
          <p className="kid-say" style={{ margin: 0 }}>
            {t('login.who')}
          </p>
          <div className="profiles">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className="profile-card"
                aria-disabled={!p.hasPin || undefined}
                onClick={() => p.hasPin && setChosen(p)}
              >
                <Momo color={p.momoColor} size={72} />
                <span>{p.nickname}</span>
                {!p.hasPin && <small>{t('login.nopin')}</small>}
              </button>
            ))}
          </div>
          <BigButton variant="ghost" onClick={() => setProfiles(null)}>
            {t('login.change')}
          </BigButton>
        </>
      )}

      {chosen && (
        <>
          <div className="kid-row" style={{ alignItems: 'center' }}>
            <Momo color={chosen.momoColor} size={72} />
            <strong style={{ fontSize: '1.6rem' }}>{chosen.nickname}</strong>
          </div>
          <PicturePin value={pin} onChange={onPinChange} shake={shake} />
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
        </>
      )}
    </main>
  );
}
