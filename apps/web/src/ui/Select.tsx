import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import './select.css';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = {
  id?: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Teks saat nilai belum cocok dengan pilihan mana pun. */
  placeholder?: string;
  /** `sm`: ringkas, untuk bilah paging dan filter. */
  size?: 'md' | 'sm';
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

const MAX_HEIGHT = 288;
const GAP = 6;
const EDGE = 8;

/** Huruf, angka, dan tanda yang bisa diketik untuk melompat ke pilihan (tanpa tombol kendali). */
const isTypeable = (e: KeyboardEvent) =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/**
 * Pilihan satu dari beberapa (pengganti `<select>` bawaan peramban yang daftarnya tidak bisa diberi gaya).
 * Pola "select-only combobox": tombol pemicu, daftar pilihan di atas halaman, dan papan ketik penuh
 * (panah, Home, End, Enter, Spasi, Esc, ketik huruf awal).
 */
export function Select({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder,
  size = 'md',
  invalid,
  className,
  ...aria
}: SelectProps) {
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const listId = `${autoId}-list`;
  const optionId = (i: number) => `${autoId}-opt-${i}`;

  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', timer: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [host, setHost] = useState<Element | null>(null);
  const [pos, setPos] = useState<CSSProperties>();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const usable = (i: number) => i >= 0 && i < options.length && !options[i]!.disabled;
  const first = () => options.findIndex((_, i) => usable(i));
  const last = () => {
    for (let i = options.length - 1; i >= 0; i--) if (usable(i)) return i;
    return -1;
  };

  /** Pilihan berikutnya yang bisa dipilih, arah `dir`; berhenti di ujung. */
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (usable(i)) return i;
    return from;
  };

  const openList = (at?: number) => {
    if (disabled || options.length === 0) return;
    // Daftar dipasang di dalam dialog atau area admin terdekat: tetap di atas dialog dan mewarisi token warnanya.
    setHost(trigger.current?.closest('dialog, .ui-shell') ?? document.body);
    setActive(at ?? (usable(selectedIndex) ? selectedIndex : first()));
    setOpen(true);
  };

  const commit = (i: number) => {
    if (!usable(i)) return;
    const next = options[i]!.value;
    setOpen(false);
    if (next !== value) onChange(next);
    trigger.current?.focus();
  };

  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = vh - r.bottom - EDGE - GAP;
    const above = r.top - EDGE - GAP;
    const wanted = Math.min(MAX_HEIGHT, options.length * 40 + 12);
    const up = below < Math.min(wanted, 160) && above > below;
    const width = Math.max(r.width, 168);
    setPos({
      left: Math.min(Math.max(EDGE, r.left), Math.max(EDGE, vw - width - EDGE)),
      width,
      maxHeight: Math.max(120, Math.min(MAX_HEIGHT, up ? above : below)),
      ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const reposition = (e: Event) => {
      if (e.target instanceof Node && list.current?.contains(e.target)) return;
      place();
    };
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!trigger.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [open, place]);

  // Pilihan yang aktif selalu terlihat saat digeser dengan papan ketik.
  useEffect(() => {
    if (open && active >= 0)
      document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  useEffect(() => () => window.clearTimeout(typed.current.timer), []);

  /** Ketik huruf awal untuk melompat; ketikan berurutan dalam 0,7 detik dibaca sebagai satu kata. */
  const typeahead = (char: string) => {
    window.clearTimeout(typed.current.timer);
    typed.current.text += char.toLowerCase();
    typed.current.timer = window.setTimeout(() => (typed.current.text = ''), 700);
    const text = typed.current.text;
    const from = open ? active : selectedIndex;
    const skip = text.length === 1 ? 1 : 0;
    for (let n = 0; n < options.length; n++) {
      const i = (Math.max(from, 0) + skip + n) % options.length;
      if (usable(i) && options[i]!.label.toLowerCase().startsWith(text)) {
        if (open) setActive(i);
        else openList(i);
        return;
      }
    }
  };

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        openList(e.key === 'Home' ? first() : last());
      } else if (isTypeable(e)) typeahead(e.key);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => step(i, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => step(i, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(first());
        break;
      case 'End':
        e.preventDefault();
        setActive(last());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        break;
      case 'Escape':
        // Menutup daftar saja; dialog di belakangnya tidak ikut tertutup.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (isTypeable(e)) typeahead(e.key);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        aria-describedby={aria['aria-describedby']}
        disabled={disabled}
        className={`ui-select-trigger${size === 'sm' ? ' ui-select-sm' : ''}${className ? ` ${className}` : ''}`}
        onClick={() => {
          if (open) return setOpen(false);
          // Safari dan Firefox di macOS tidak memfokuskan tombol saat diklik, padahal papan ketik perlu fokus di sini.
          trigger.current?.focus();
          openList();
        }}
        onKeyDown={onKeyDown}
      >
        <span className={`ui-select-value${selected ? '' : ' is-placeholder'}`}>
          {selected?.label ?? placeholder ?? ''}
        </span>
        <svg className="ui-select-chevron" viewBox="0 0 20 20" aria-hidden>
          <path
            d="M5 7.5l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open &&
        host &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={aria['aria-label']}
            aria-labelledby={aria['aria-labelledby'] ?? triggerId}
            className={`ui-select-pop${size === 'sm' ? ' ui-select-sm' : ''}`}
            style={pos}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={i === selectedIndex}
                aria-disabled={o.disabled || undefined}
                data-active={i === active || undefined}
                className="ui-select-opt"
                // Daftar tidak merebut fokus dari tombol pemicu.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => usable(i) && setActive(i)}
                onClick={() => commit(i)}
              >
                <span className="ui-select-opt-label">{o.label}</span>
                {i === selectedIndex && (
                  <svg className="ui-select-check" viewBox="0 0 20 20" aria-hidden>
                    <path
                      d="M4.5 10.5l3.6 3.6 7.4-8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            ))}
          </ul>,
          host,
        )}
    </>
  );
}
