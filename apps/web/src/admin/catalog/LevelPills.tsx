import type { CatalogLevel } from '../../api/adminTypes';
import { t } from '../../i18n';

/** Kelas warna satu pil level: hijau gratis, kuning Premium, garis putus-putus bila belum ada soal. */
const pillClass = (l: Pick<CatalogLevel, 'free' | 'source'>) =>
  `syl-pill ${l.free ? 'is-free' : 'is-premium'}${l.source === 'none' ? ' is-empty' : ''}`;

/** Deretan pil nomor level satu topik. Hiasan: ringkasannya sudah ada di teks di sebelahnya. */
export function LevelPills({ levels }: { levels: readonly CatalogLevel[] }) {
  return (
    <span className="syl-pills" aria-hidden>
      {levels.map((l) => (
        <span
          key={l.id}
          className={pillClass(l)}
          title={`${t('admin.catalog.level.title', { n: l.number })}: ${l.title}`}
        >
          {l.number}
        </span>
      ))}
    </span>
  );
}

/** Contoh pil dengan nomor dan keadaan sendiri (kartu akses berbayar). */
export function SamplePill({ n, free }: { n: number; free: boolean }) {
  return <span className={pillClass({ free, source: 'auto' })}>{n}</span>;
}

/** Keterangan warna pil level. */
export function Legend() {
  return (
    <p className="syl-legend" aria-label={t('admin.catalog.legend')}>
      <span>
        <i className="syl-dot is-free" aria-hidden />
        {t('admin.catalog.legendFree')}
      </span>
      <span>
        <i className="syl-dot is-premium" aria-hidden />
        {t('admin.catalog.legendPremium')}
      </span>
      <span>
        <i className="syl-dot is-empty" aria-hidden />
        {t('admin.catalog.legendNone')}
      </span>
    </p>
  );
}
