import type { AnswerBody } from '@udakids/engine';
import { useSession } from '../auth/store';
import * as http from './http/practice';
import * as mock from './mock/practice';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;

export const startRound = (levelId: string) =>
  isMocked('practice') ? mock.startRound(token(), levelId) : http.startRound(levelId);
export const answer = (roundId: string, body: AnswerBody) =>
  isMocked('practice') ? mock.answer(token(), roundId, body) : http.answer(roundId, body);
export const finish = (roundId: string) =>
  isMocked('practice') ? mock.finish(token(), roundId) : http.finish(roundId);
export const result = (roundId: string) =>
  isMocked('practice') ? mock.result(token(), roundId) : http.result(roundId);
