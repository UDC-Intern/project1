export type TopicScore = { topicId: string; title: string; score: number };

/**
 * Saran topik di laporan orang tua: topik yang pernah dimainkan dan belum 100,
 * dengan skor terendah dulu, paling banyak `limit`.
 */
export function suggestTopics(topics: readonly TopicScore[], limit = 3): TopicScore[] {
  return topics
    .filter((t) => t.score > 0 && t.score < 100)
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, 'id'))
    .slice(0, limit);
}

/** Persen benar dari semua jawaban, atau null bila belum ada jawaban. */
export function accuracy(correct: number, total: number): number | null {
  return total <= 0 ? null : Math.round((correct / total) * 100);
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
