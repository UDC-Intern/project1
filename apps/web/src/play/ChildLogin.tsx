import type { PinPicture } from '@udakids/engine';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { childLogin, familyProfiles } from '../api/auth';
import { ApiError } from '../api/client';
import { api } from '../api/pageApi';
import { getSession, rememberFamilyCode, rememberedFamilyCode, setSession } from '../auth/session';
import { useSession } from '../auth/store';
import { BigButton } from '../components/BigButton';
import { ListenButton } from '../components/ListenButton';
import { Momo } from '../components/Momo';
import { PicturePin } from '../components/PicturePin';
import { APP_NAME } from '../config/app';
import { useT } from '../i18n';
import { AutoSpeak } from './AutoSpeak';

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
  const [initializing, setInitializing] = useState(
    () => !!getSession('parent') || !!rememberedFamilyCode(),
  );

  const explain = useCallback(
    (err: unknown): string => {
      if (!(err instanceof ApiError)) return t('error.generic');
      if (err.body.code === 'TEMPORARILY_LOCKED') {
        const ms = err.body.lockedUntil ? Date.parse(err.body.lockedUntil) - Date.now() : 60_000;
        return t('error.TEMPORARILY_LOCKED', { minutes: Math.max(1, Math.ceil(ms / 60_000)) });
      }
      if (err.body.code === 'WRONG_PIN' || err.body.code === 'NOT_FOUND')
        return t(`error.${err.body.code}`);
      return t('error.generic');
    },
    [t],
  );

  const loadProfiles = useCallback(
    async (familyCode: string) => {
      setBusy(true);
      setMessage(null);
      setCode(familyCode);
      try {
        const res = await familyProfiles(familyCode);
        rememberFamilyCode(familyCode);
        setProfiles(res.profiles);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) rememberFamilyCode(null);
        setMessage(explain(err));
      } finally {
        setBusy(false);
      }
    },
    [explain],
  );

  useEffect(() => {
    if (session?.role === 'child') return;
    const parent = getSession('parent');
    const remembered = rememberedFamilyCode();
    if (!parent && !remembered) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        let familyCode = parent?.familyCode;
        if (parent && !familyCode) {
          const account = await api<{ familyCode: string }>('/parent/account', {
            token: parent.token,
          });
          familyCode = account.familyCode;
          if (!cancelled) setSession('parent', { ...parent, familyCode });
        }
        if (!cancelled && (familyCode || remembered))
          await loadProfiles((familyCode || remembered)!);
      } catch (err) {
        if (!cancelled) setMessage(explain(err));
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [explain, loadProfiles, session?.role]);

  async function findFamily() {
    await loadProfiles(code);
  }

  async function submitPin(next: PinPicture[]) {
    if (!chosen || next.length !== 3) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await childLogin({ childId: chosen.id, pin: [next[0]!, next[1]!, next[2]!] });
      signIn({ token: res.token, role: 'child', name: res.child.nickname, id: res.child.id });
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

  if (session?.role === 'child') return <Navigate to="/play" replace />;

  const say = initializing
    ? t('login.checking')
    : chosen
      ? t('pin.title')
      : profiles
        ? t('login.who')
        : t('login.say');

  return (
    <>
      <header className="kid-nav">
        <Link to="/" className="site-brand" aria-label={APP_NAME}>
          <Momo mood="happy" size={40} />
          <span>{APP_NAME}</span>
        </Link>
        <Link to="/" className="kid-nav-back">
          <span aria-hidden="true">←</span> {t('login.home')}
        </Link>
      </header>
      <main className="kid-screen kid-login">
        <AutoSpeak text={say} />
        <Momo
          color={chosen?.momoColor ?? 'blue'}
          mood={message ? 'encourage' : 'happy'}
          size={140}
        />
        <div className="kid-say">
          <ListenButton text={say} />
          <h1 style={{ margin: 0, fontSize: 'inherit' }}>{say}</h1>
        </div>

        {message && (
          <p className="kid-note" role="alert">
            {message}
          </p>
        )}

        {!profiles && initializing && <p className="kid-note">{t('login.checking')}</p>}
        {!profiles && !initializing && (
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
            <PicturePin value={pin} onChange={onPinChange} shake={shake} title={false} />
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
    </>
  );
}
