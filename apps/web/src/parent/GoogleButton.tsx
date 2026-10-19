import { useEffect, useRef, useState } from 'react';
import { request } from '../api/client';

type GoogleId = {
  initialize(options: Record<string, unknown>): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
  cancel(): void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let script: Promise<GoogleId> | null = null;
function loadGoogle() {
  script ??= new Promise<GoogleId>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const tag = document.createElement('script');
    tag.src = 'https://accounts.google.com/gsi/client';
    tag.async = true;
    tag.defer = true;
    tag.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else {
        script = null;
        reject(new Error('Google tidak tersedia'));
      }
    };
    tag.onerror = () => {
      script = null;
      reject(new Error('Google tidak tersedia'));
    };
    document.head.appendChild(tag);
  });
  return script;
}

export function GoogleButton({
  onCredential,
  text,
}: {
  onCredential: (value: string) => void;
  text: 'signin_with' | 'signup_with';
}) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'off'>('loading');
  const callback = useRef(onCredential);
  callback.current = onCredential;
  useEffect(() => {
    let alive = true;
    let finished = false;
    let client: GoogleId | undefined;
    const stop = () => {
      if (!alive || finished) return;
      finished = true;
      setStatus('off');
    };
    const timer = window.setTimeout(stop, 6000);
    void request<{ clientId: string | null }>('/auth/parent/google')
      .then(async ({ clientId }) => {
        if (!clientId) throw new Error('Google belum dikonfigurasi');
        client = await loadGoogle();
        if (!alive || finished || !box.current) return;
        client.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) callback.current(response.credential);
          },
          context: text === 'signup_with' ? 'signup' : 'signin',
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_prompt: true,
        });
        client.renderButton(box.current, {
          type: 'standard',
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'left',
          locale: 'id',
          width: Math.min(400, Math.max(240, box.current.clientWidth || 320)),
        });
        window.clearTimeout(timer);
        finished = true;
        setStatus('ready');
        client.prompt();
      })
      .catch(stop);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      if (finished && client) client.cancel();
    };
  }, [text]);
  if (status === 'off') return null;
  return (
    <div className="auth-google" aria-busy={status === 'loading'}>
      {status === 'loading' && <span className="auth-google-loading">Menyiapkan Google…</span>}
      <div ref={box} className="auth-google-button" />
    </div>
  );
}
