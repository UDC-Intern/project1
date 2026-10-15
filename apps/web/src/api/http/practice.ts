import type { AnswerBody, AnswerResult, RoundResult, StartRoundResult } from '@udakids/engine';
import { request } from '../client';

export const startRound = (levelId: string) =>
  request<StartRoundResult>('/practice/rounds', { method: 'POST', body: { levelId } });
export const answer = (roundId: string, body: AnswerBody) =>
  request<AnswerResult>(`/practice/rounds/${encodeURIComponent(roundId)}/answers`, {
    method: 'POST',
    body,
  });
export const finish = (roundId: string) =>
  request<RoundResult>(`/practice/rounds/${encodeURIComponent(roundId)}/finish`, {
    method: 'POST',
  });
export const result = (roundId: string) =>
  request<RoundResult>(`/practice/rounds/${encodeURIComponent(roundId)}`);
