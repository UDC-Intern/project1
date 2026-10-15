import { describe, expect, it } from 'vitest';
import { accuracy, suggestTopics } from '../src/scoring/report.js';

describe('laporan', () => {
  it('saran topik: yang pernah dimainkan, belum 100, skor terendah dulu, maksimal 3', () => {
    const topics = [
      { topicId: 'a', title: 'A', score: 80 },
      { topicId: 'b', title: 'B', score: 0 },
      { topicId: 'c', title: 'C', score: 100 },
      { topicId: 'd', title: 'D', score: 24 },
      { topicId: 'e', title: 'E', score: 48 },
      { topicId: 'f', title: 'F', score: 48 },
    ];
    expect(suggestTopics(topics).map((t) => t.topicId)).toEqual(['d', 'e', 'f']);
    expect(suggestTopics(topics, 1)).toHaveLength(1);
    expect(suggestTopics([])).toEqual([]);
  });

  it('ketepatan null bila belum ada jawaban', () => {
    expect(accuracy(0, 0)).toBeNull();
    expect(accuracy(7, 10)).toBe(70);
    expect(accuracy(2, 3)).toBe(67);
  });
});
