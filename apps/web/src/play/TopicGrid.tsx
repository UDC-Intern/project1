import type { BookDetail } from '@udakids/engine';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';

/** Kartu topik: nomor, judul, dan bilah kemajuan level yang lulus. */
export function TopicGrid({ topics }: { topics: BookDetail['topics'] }) {
  const t = useT('play');
  const nextIndex = topics.findIndex((tp) => tp.levelsPassed < tp.levelsTotal);
  return (
    <ul className="topic-grid">
      {topics.map((topic, i) => {
        const done = topic.levelsPassed >= topic.levelsTotal;
        const state = done ? ' is-done' : i === nextIndex ? ' is-next' : '';
        const pct = Math.round((topic.levelsPassed / Math.max(1, topic.levelsTotal)) * 100);
        return (
          <li key={topic.id}>
            <Link
              to={`/play/topik/${topic.id}`}
              className={`topic-card${state}`}
              aria-label={`${topic.title}. ${t('book.progress', { passed: topic.levelsPassed, total: topic.levelsTotal })}`}
            >
              <span className="topic-num">{i + 1}</span>
              <span className="topic-title">{topic.title}</span>
              <span className="topic-foot">
                <span className="topic-bar" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="topic-count">
                  {topic.levelsPassed}/{topic.levelsTotal}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
