import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import {
  PALETTES,
  SHEET_H,
  SHEET_W,
  sheetLabel,
  sheetShapes,
  textWidth,
  type Ink,
  type Shape,
  type SheetData,
} from './sheet';

function ShapeSvg({ s, palette }: { s: Shape; palette: Record<Ink, string> }) {
  const v = (ink?: Ink) => (ink ? `var(${palette[ink]})` : 'none');
  switch (s.kind) {
    case 'rect':
      return (
        <rect
          x={s.x}
          y={s.y}
          width={s.w}
          height={s.h}
          rx={s.r}
          style={{ fill: v(s.fill), stroke: v(s.stroke), strokeWidth: s.width, opacity: s.opacity }}
        />
      );
    case 'circle':
      return (
        <circle
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          style={{
            fill: v(s.fill),
            stroke: v(s.stroke),
            strokeWidth: s.width,
            strokeDasharray: s.dash ? `${s.dash} ${s.dash + 1}` : undefined,
          }}
        />
      );
    case 'path':
      return (
        <path
          d={s.d}
          style={{
            fill: v(s.fill),
            stroke: v(s.stroke),
            strokeWidth: s.width,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        />
      );
    case 'text': {
      const style: CSSProperties = {
        fill: v(s.fill),
        fontFamily: s.font === 'display' ? 'var(--font-display)' : 'var(--font-body)',
        fontSize: s.size,
        fontWeight: s.weight,
        letterSpacing: s.spacing,
        opacity: s.opacity,
      };
      // Teks yang terlalu panjang dirapatkan agar tetap di dalam bingkai.
      const squeeze =
        s.maxWidth && textWidth(s) > s.maxWidth
          ? { textLength: s.maxWidth, lengthAdjust: 'spacingAndGlyphs' as const }
          : {};
      return (
        <text
          x={s.x}
          y={s.y}
          textAnchor={s.anchor ?? 'middle'}
          transform={s.rotate ? `rotate(${s.rotate} ${s.x} ${s.y})` : undefined}
          style={style}
          {...squeeze}
        >
          {s.text}
        </text>
      );
    }
    case 'group':
      return (
        <g transform={`translate(${s.x} ${s.y}) scale(${s.scale})`}>
          {s.children.map((c, i) => (
            <ShapeSvg key={i} s={c} palette={palette} />
          ))}
        </g>
      );
  }
}

/** Lembar sertifikat A4 mendatar sebagai SVG: tajam di layar, di kertas, dan di PDF. */
export function CertificateSheet({ data, className }: { data: SheetData; className?: string }) {
  const palette = PALETTES[data.design];
  return (
    <svg
      className={`cert-sheet${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
      role="img"
      aria-label={sheetLabel(data)}
      data-design={data.design}
    >
      {sheetShapes(data).map((s, i) => (
        <ShapeSvg key={i} s={s} palette={palette} />
      ))}
    </svg>
  );
}

/** Salinan lembar untuk dicetak: tersembunyi di layar, satu-satunya isi halaman saat `printCertificate`. */
export function CertificatePrint({ data }: { data: SheetData }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="cert-print-root" aria-hidden="true">
      <CertificateSheet data={data} />
    </div>,
    document.body,
  );
}
