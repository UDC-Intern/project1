import { useEffect, type ReactNode } from 'react';

/** Dialog sederhana: tutup dengan Escape atau tombol di dalam isinya. */
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Kotak lebar, mis. untuk pratinjau sertifikat. */
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc di pop-up konfirmasi (elemen <dialog>) hanya menutup konfirmasinya, bukan dialog di belakangnya.
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="uk-dialog-backdrop">
      <div
        className={`uk-dialog uk-card${wide ? ' uk-dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
