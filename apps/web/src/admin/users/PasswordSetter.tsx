import { useState, type FormEvent } from 'react';
import { t } from '../../i18n';
import { Button, TextField } from '../../ui/ui';

export const MIN_PASSWORD = 8;

/** Tombol "Atur password" yang membuka form kecil (minimal 8 karakter). */
export function PasswordSetter({
  onSubmit,
  busy,
  note,
}: {
  onSubmit: (password: string) => Promise<boolean>;
  busy?: boolean;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {t('admin.user.setPassword')}
      </Button>
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await onSubmit(password)) {
      setPassword('');
      setOpen(false);
    }
  }
  return (
    <form className="adm-inline-form" onSubmit={submit}>
      <TextField
        label={t('admin.user.newPassword')}
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {note && <p className="ui-hint">{note}</p>}
      <Button type="submit" disabled={busy || password.length < MIN_PASSWORD}>
        {t('admin.save')}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        {t('admin.cancel')}
      </Button>
    </form>
  );
}
