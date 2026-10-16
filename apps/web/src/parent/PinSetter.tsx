import { useState } from 'react';
import { OBJECTS, PIN_LENGTH, PIN_PICTURES, type PinPicture } from '@udakids/engine';
import { VisualView } from '../components/visuals';
import { t } from '../i18n';
import { Button, Notice } from '../ui/ui';

export const pictureName = (p: PinPicture) => OBJECTS[p].say;

type Step = 'choose' | 'confirm' | 'done';

function Sequence({ pin }: { pin: PinPicture[] }) {
  return (
    <ol className="pa-pin-seq" aria-label={t('parent.pin.sequence')}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => {
        const p = pin[i];
        return (
          <li
            key={i}
            className={p ? 'pa-pin-slot filled' : 'pa-pin-slot'}
            aria-label={
              p
                ? t('parent.pin.slot', { n: i + 1, name: pictureName(p) })
                : t('parent.pin.slotEmpty', { n: i + 1 })
            }
          >
            <span className="pa-pin-slot-n" aria-hidden>
              {i + 1}
            </span>
            {p && (
              <span aria-hidden>
                <VisualView visual={{ kind: 'object', object: p }} size={40} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Pembuat sandi gambar: ketuk 3 dari 9 gambar berurutan (boleh berulang), lalu ulangi untuk
 * konfirmasi. `onChange` menerima sandi yang sudah cocok, atau null bila belum/diubah lagi.
 */
export function PinSetter({ onChange }: { onChange: (pin: PinPicture[] | null) => void }) {
  const [step, setStep] = useState<Step>('choose');
  const [first, setFirst] = useState<PinPicture[]>([]);
  const [second, setSecond] = useState<PinPicture[]>([]);
  const [mismatch, setMismatch] = useState(false);

  const current = step === 'confirm' ? second : first;
  const setCurrent = step === 'confirm' ? setSecond : setFirst;

  function pick(p: PinPicture) {
    if (current.length >= PIN_LENGTH) return;
    const next = [...current, p];
    setMismatch(false);
    if (step === 'confirm' && next.length === PIN_LENGTH) {
      if (next.every((x, i) => x === first[i])) {
        setSecond(next);
        setStep('done');
        onChange(next);
      } else {
        setSecond([]);
        setMismatch(true);
      }
      return;
    }
    setCurrent(next);
  }

  function restart() {
    setStep('choose');
    setFirst([]);
    setSecond([]);
    setMismatch(false);
    onChange(null);
  }

  if (step === 'done') {
    return (
      <div className="pa-pin">
        <Notice tone="success">
          {t('parent.pin.done', { seq: first.map(pictureName).join(', ') })}
        </Notice>
        <Sequence pin={first} />
        <p className="ui-hint pa-pin-tip">{t('parent.pin.tip')}</p>
        <Button variant="ghost" onClick={restart}>
          {t('parent.pin.change')}
        </Button>
      </div>
    );
  }

  return (
    <div className="pa-pin">
      <p className="pa-pin-step">
        {step === 'choose' ? t('parent.pin.stepChoose') : t('parent.pin.stepConfirm')}
      </p>
      {mismatch && <Notice tone="warning">{t('parent.pin.mismatch')}</Notice>}
      <Sequence pin={current} />
      <div className="pa-pin-grid" role="group" aria-label={t('parent.pin.grid')}>
        {PIN_PICTURES.map((p) => (
          <button
            key={p}
            type="button"
            className="pa-pin-pic"
            aria-label={t('parent.pin.pick', { name: pictureName(p) })}
            disabled={current.length >= PIN_LENGTH}
            onClick={() => pick(p)}
          >
            <span aria-hidden>
              <VisualView visual={{ kind: 'object', object: p }} size={56} />
            </span>
          </button>
        ))}
      </div>
      <div className="ui-row">
        <Button
          variant="ghost"
          disabled={current.length === 0}
          onClick={() => setCurrent(current.slice(0, -1))}
        >
          {t('parent.pin.undo')}
        </Button>
        <Button variant="ghost" disabled={first.length === 0} onClick={restart}>
          {t('parent.pin.reset')}
        </Button>
        {step === 'choose' && (
          <Button
            variant="secondary"
            disabled={first.length < PIN_LENGTH}
            onClick={() => {
              setStep('confirm');
              setSecond([]);
            }}
          >
            {t('parent.pin.next')}
          </Button>
        )}
      </div>
      <p className="ui-hint pa-pin-tip">{t('parent.pin.tip')}</p>
    </div>
  );
}
