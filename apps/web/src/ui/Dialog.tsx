import { useEffect, useRef, type ReactNode } from 'react';

/** Dialog yang sedang terbuka, yang paling atas di paling belakang: Esc hanya menutup yang paling atas. */
const open: symbol[] = [];

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
  // Penutup terbaru dibaca lewat ref, supaya urutan tumpukan tidak berubah saat dialog digambar ulang.
  const closer = useRef(onClose);
  useEffect(() => {
    closer.current = onClose;
  });
  useEffect(() => {
    const me = Symbol('dialog');
    open.push(me);
    const onKey = (e: KeyboardEvent) => {
      // Esc di pop-up konfirmasi (elemen <dialog>) hanya menutup konfirmasinya, bukan dialog di belakangnya;
      // dialog yang ditumpuk (mis. pemilih gambar di atas dialog soal) juga hanya menutup yang paling atas.
      if (e.key === 'Escape' && !document.querySelector('dialog[open]') && open.at(-1) === me)
        closer.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(me), 1);
    };
  }, []);

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
