import { Momo } from '../components/Momo';
import { useT } from '../i18n';

/** Halaman area anak yang dibuat di tahap berikutnya (peringkat, profil, ronde). */
export function ComingSoon() {
  const t = useT('play');
  return (
    <div className="uk-empty">
      <Momo mood="encourage" size={112} />
      <h1>{t('soon')}</h1>
    </div>
  );
}
