import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { book } from '../api/catalog';
import { PageHead } from '../components/PageHead';
import { useAsync } from '../hooks/useAsync';
import { ErrorState, LoadingState } from '../ui/states';
import { TopicGrid } from './TopicGrid';
import { AutoSpeak } from './AutoSpeak';

export function BookPage() {
  const { slug = '' } = useParams();
  const load = useCallback(() => book(slug), [slug]);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <main className="library" data-mapel={data.book.subject === 'science' ? 'sains' : 'matematika'}>
      <AutoSpeak text={data.book.title} />
      <PageHead title={data.book.title} />
      <TopicGrid topics={data.topics} />
    </main>
  );
}
