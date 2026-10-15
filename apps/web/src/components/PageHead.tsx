import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { BackIcon } from './Icons';

/** Kepala halaman anak: tombol kembali, judul, dan keterangan singkat. */
export function PageHead({
  title,
  sub,
  back = '/play',
}: {
  title: string;
  sub?: string;
  back?: string;
}) {
  const t = useT('play');
  return (
    <header className="practice-head">
      <Link to={back} className="kid-link" aria-label={t('back')}>
        <BackIcon size={30} />
      </Link>
      <div className="practice-title">
        <strong>{title}</strong>
        {sub && <span>{sub}</span>}
      </div>
      <span />
    </header>
  );
}
