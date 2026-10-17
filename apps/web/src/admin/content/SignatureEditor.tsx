import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import type { SignatureType } from '@udakids/engine';
import { t, type MessageKey } from '../../i18n';
import { Segmented } from '../../ui/controls';
import { Button, Notice } from '../../ui/ui';
import { SIGN_H, SIGN_W } from './signature';
import { SIGNATURE_MIME, processSignatureFile, type SignatureProblem } from './signatureFile';

export type SignatureValue = { type: SignatureType; image: string };

/** Ukuran kanvas tulis di layar (px); isinya digambar dua kali lipat (700 × 240) supaya tajam. */
const PAD_W = 350;
const PAD_H = 120;
/** Selang paling singkat antar pembaruan pratinjau saat sedang menggores (ms). */
const LIVE_MS = 140;

type Point = { x: number; y: number };

/** Warna tinta kanvas: token `--malam`, dengan cadangan bila token belum terpasang. */
const inkOf = (el: Element) => getComputedStyle(el).getPropertyValue('--malam').trim() || '#1c2430';

/**
 * Pilihan tanda tangan di lembar sertifikat: goresan bawaan, ditulis langsung di kanvas (mouse atau sentuhan), atau
 * foto/scan yang diunggah (latar kertas dibersihkan otomatis). Gambar dari tiap cara diingat selama dialog terbuka,
 * jadi berpindah pilihan tidak menghapus hasil yang sudah dibuat.
 */
export function SignatureEditor({
  value,
  onChange,
}: {
  value: SignatureValue;
  onChange: (next: SignatureValue) => void;
}) {
  const id = useId();
  const [drawn, setDrawn] = useState(value.type === 'draw' ? value.image : '');
  const [uploaded, setUploaded] = useState(value.type === 'upload' ? value.image : '');
  const [problem, setProblem] = useState<SignatureProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const [inked, setInked] = useState(!!drawn);

  const pad = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const stroke = useRef<{ id: number; last: Point; mid: Point } | null>(null);
  const lastLive = useRef(0);
  const type = value.type;

  function pick(next: SignatureType) {
    setProblem(null);
    const image = next === 'draw' ? drawn : next === 'upload' ? uploaded : '';
    onChange({ type: next, image });
  }

  // ---- Kanvas tulis ----

  // Gambar yang sudah ada digambar lagi bila kanvas muncul kembali (setelah berpindah pilihan).
  useEffect(() => {
    const canvas = pad.current;
    if (type !== 'draw' || !canvas || !drawn) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = drawn;
    return () => {
      alive = false;
    };
    // Hanya saat kanvas baru dipasang; goresan baru sudah ada di kanvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const at = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / (r.width || canvas.width),
      y: ((e.clientY - r.top) * canvas.height) / (r.height || canvas.height),
    };
  };

  const commit = useCallback(() => {
    const canvas = pad.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    setDrawn(image);
    onChange({ type: 'draw', image });
  }, [onChange]);

  function begin(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx || (e.pointerType === 'mouse' && e.button !== 0)) return;
    canvas.setPointerCapture?.(e.pointerId);
    const p = at(e);
    stroke.current = { id: e.pointerId, last: p, mid: p };
    ctx.fillStyle = inkOf(canvas);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    setInked(true);
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    const s = stroke.current;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!s || s.id !== e.pointerId || !ctx) return;
    const p = at(e);
    // Garis halus: kurva dari titik tengah ke titik tengah dengan titik sentuhan sebagai pengendali.
    const mid = { x: (s.last.x + p.x) / 2, y: (s.last.y + p.y) / 2 };
    ctx.strokeStyle = inkOf(canvas);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s.mid.x, s.mid.y);
    ctx.quadraticCurveTo(s.last.x, s.last.y, mid.x, mid.y);
    ctx.stroke();
    s.last = p;
    s.mid = mid;
    // Pratinjau di lembar ikut bergerak saat menggores, tidak menunggu jari diangkat.
    const now = performance.now();
    if (now - lastLive.current > LIVE_MS) {
      lastLive.current = now;
      commit();
    }
  }

  function end(e: PointerEvent<HTMLCanvasElement>) {
    const s = stroke.current;
    if (!s || s.id !== e.pointerId) return;
    stroke.current = null;
    commit();
  }

  function clearPad() {
    const canvas = pad.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setDrawn('');
    setInked(false);
    onChange({ type: 'draw', image: '' });
  }

  // ---- Unggah foto atau scan ----

  async function choose(files: FileList | null) {
    const chosen = files?.[0];
    if (!chosen) return;
    setProblem(null);
    setBusy(true);
    const result = await processSignatureFile(chosen).catch(
      () => ({ ok: false, problem: 'read' }) as const,
    );
    setBusy(false);
    if (file.current) file.current.value = '';
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    setUploaded(result.dataUrl);
    onChange({ type: 'upload', image: result.dataUrl });
  }

  function removeUpload() {
    setUploaded('');
    setProblem(null);
    onChange({ type: 'upload', image: '' });
  }

  return (
    <div className="sign-editor">
      <Segmented
        label={t('admin.certSettings.sign.mode')}
        value={type}
        onChange={pick}
        options={[
          { value: 'default', label: t('admin.certSettings.sign.default') },
          { value: 'draw', label: t('admin.certSettings.sign.draw') },
          { value: 'upload', label: t('admin.certSettings.sign.upload') },
        ]}
      />

      {type === 'default' && <p className="ui-hint">{t('admin.certSettings.sign.defaultHint')}</p>}

      {type === 'draw' && (
        <div className="sign-draw">
          <div className="sign-pad" style={{ maxWidth: PAD_W }}>
            <canvas
              ref={pad}
              className="sign-canvas"
              width={SIGN_W}
              height={SIGN_H}
              style={{ aspectRatio: `${PAD_W} / ${PAD_H}` }}
              role="img"
              aria-label={t('admin.certSettings.sign.canvas')}
              aria-describedby={`${id}-draw`}
              onPointerDown={begin}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
            {!inked && (
              <span className="sign-placeholder">{t('admin.certSettings.sign.placeholder')}</span>
            )}
          </div>
          <div className="ui-row">
            <Button variant="ghost" size="sm" disabled={!inked} onClick={clearPad}>
              {t('admin.certSettings.sign.clear')}
            </Button>
            <small id={`${id}-draw`} className="ui-hint">
              {t('admin.certSettings.sign.drawHint')}
            </small>
          </div>
        </div>
      )}

      {type === 'upload' && (
        <div className="sign-upload">
          <input
            ref={file}
            id={`${id}-file`}
            className="sign-file"
            type="file"
            accept={SIGNATURE_MIME.join(',')}
            aria-label={t('admin.certSettings.sign.file')}
            tabIndex={-1}
            onChange={(e) => void choose(e.target.files)}
          />
          <div className="ui-row">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              {uploaded ? t('admin.certSettings.sign.change') : t('admin.certSettings.sign.pick')}
            </Button>
            {uploaded && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={removeUpload}>
                {t('admin.certSettings.sign.remove')}
              </Button>
            )}
            {busy && <small className="ui-hint">{t('admin.certSettings.sign.processing')}</small>}
          </div>
          <small className="ui-hint">{t('admin.certSettings.sign.uploadHint')}</small>
          {problem && (
            <Notice tone="error">
              {t(`admin.certSettings.sign.error.${problem}` as MessageKey)}
            </Notice>
          )}
          {uploaded && !problem && (
            <figure className="sign-thumb">
              <img src={uploaded} alt={t('admin.certSettings.sign.previewAlt')} />
              <figcaption className="ui-hint">{t('admin.certSettings.sign.done')}</figcaption>
            </figure>
          )}
        </div>
      )}
    </div>
  );
}
