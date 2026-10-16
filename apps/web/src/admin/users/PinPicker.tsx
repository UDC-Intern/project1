import { useState } from 'react';
import { OBJECTS, PIN_LENGTH, PIN_PICTURES, type PinPicture } from '@udakids/engine';
import { PinPictureIcon } from '../../components/PicturePin';
import { t } from '../../i18n';
import { Button } from '../../ui/ui';

/** Pemilih sandi gambar 3×3: ketuk 3 gambar berurutan (boleh berulang). */
export function PinPicker({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (pin: PinPicture[]) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [pin, setPin] = useState<PinPicture[]>([]);
  const full = pin.length >= PIN_LENGTH;
  return (
    <div className="adm-picker" role="group" aria-label={t('admin.pin.title')}>
      <p style={{ marginTop: 0 }}>{t('admin.pin.hint', { n: PIN_LENGTH })}</p>
      <div className="ui-row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <div className="adm-pin-grid">
          {PIN_PICTURES.map((p) => (
            <button
              key={p}
              type="button"
              disabled={full}
              aria-label={OBJECTS[p].say}
              onClick={() => setPin((xs) => (xs.length < PIN_LENGTH ? [...xs, p] : xs))}
            >
              <PinPictureIcon name={p} size={48} />
            </button>
          ))}
        </div>
        <div>
          <strong>{t('admin.pin.chosen')}</strong>
          <div className="adm-pin-chosen" aria-live="polite">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span
                className="adm-pin-slot"
                key={i}
                aria-label={pin[i] ? OBJECTS[pin[i]].say : t('admin.pin.empty')}
              >
                {pin[i] && <PinPictureIcon name={pin[i]} size={36} />}
              </span>
            ))}
          </div>
          <div className="ui-row" style={{ marginTop: 10 }}>
            <Button disabled={!full || busy} onClick={() => onSubmit(pin)}>
              {t('admin.pin.save')}
            </Button>
            <Button
              variant="ghost"
              disabled={pin.length === 0}
              onClick={() => setPin((xs) => xs.slice(0, -1))}
            >
              {t('admin.pin.undo')}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              {t('admin.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
