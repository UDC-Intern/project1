import { useEffect, useRef, useState } from 'react';
import { request } from '../api/client';

type GoogleId = {
  initialize(options: Record<string, unknown>): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
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
    tag.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject());
    tag.onerror = () => reject();
    document.head.appendChild(tag);
  });
  return script;
}

export function GoogleButton({ onCredential, text }: { onCredential: (value: string) => void; text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'off'>('loading');
  const callback = useRef(onCredential);
  callback.current = onCredential;
  useEffect(() => {
    let alive = true;
    let client: GoogleId | undefined;
    void request<{ clientId: string | null }>('/auth/parent/google')
      .then(async ({ clientId }) => {
        if (!clientId) throw new Error('Google belum dikonfigurasi');
        client = await loadGoogle();
        if (!alive || !box.current) return;
        client.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) callback.current(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        client.renderButton(box.current, { type: 'standard', theme: 'outline', size: 'large', text, width: 320 });
        setStatus('ready');
      })
      .catch(() => alive && setStatus('off'));
    return () => {
      alive = false;
      client?.cancel();
    };
  }, [text]);
  if (status === 'off') return null;
  return <div className="auth-google" aria-busy={status === 'loading'}><div ref={box} /></div>;
}
