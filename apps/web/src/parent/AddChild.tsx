import type { MomoColor } from '@udakids/engine';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChild } from '../api/parent';
import { ApiError } from '../api/client';
import { useT } from '../i18n';
import { ColorPicker } from '../ui/ColorPicker';
import { FormField } from '../ui/FormField';

export function AddChild() {
  const t = useT('parent');
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [momoColor, setMomoColor] = useState<MomoColor>('blue');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const child = await createChild({ nickname, momoColor });
      navigate(`/orang-tua/anak/${child.id}/sandi`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
      setBusy(false);
    }
  }

  return (
    <div className="uk-stack" style={{ maxWidth: 480 }}>
      <h1>{t('add.title')}</h1>
      <form className="uk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
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
        <button type="submit" className="uk-btn" disabled={busy || nickname.trim().length < 2}>
          {t('add.submit')}
        </button>
      </form>
    </div>
  );
}
