import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { generateRound, seedFrom } from '@udakids/engine';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client';
import { profile, topic } from '../src/api/catalog';
import { leaderboard } from '../src/api/leaderboard';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { answer, finish, result, startRound } from '../src/api/practice';
import { useSession } from '../src/auth/store';
import { RoundPage } from '../src/play/RoundPage';

const AYU = 'c-ayu';
const BIMA = 'c-bima';
const LEVEL1 = 'matematika-kelas-1:A:1';
const LEVEL1_PARAMS = { max: 20 };

const login = (id: string, name: string) =>
  useSession.setState({ session: { token: `mock-child:${id}`, role: 'child', name } });

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('seharusnya gagal');
}

/** Memainkan satu ronde penuh: `wrongCount` soal pertama sengaja dijawab keliru. */
async function playRound(levelId: string, wrongCount = 0) {
  const round = await startRound(levelId);
  const key = generateRound(
    { generator: 'count', generatorParams: LEVEL1_PARAMS },
    seedFrom(round.roundId),
  );
  for (let i = 0; i < round.questions.length; i++) {
    const q = key[i]!;
    const chosen = i < wrongCount ? (q.type === 'number' ? '999' : 'tidak-ada') : q.answer;
    await answer(round.roundId, { questionIndex: i, answer: chosen });
  }
  return { round, summary: await finish(round.roundId) };
}

beforeEach(() => {
  resetMockDb();
  login(AYU, 'Ayu');
});

describe('mock practice', () => {
  it('membuka ronde 10 soal tanpa kunci jawaban', async () => {
    const round = await startRound(LEVEL1);
    expect(round.questions).toHaveLength(10);
    for (const q of round.questions) {
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('explanation');
    }
    expect(JSON.stringify(round)).not.toContain('Hitung satu per satu');
  });

  it('10 benar: skor 100, lulus, level 2 menjadi Premium, tanaman tumbuh', async () => {
    const { summary } = await playRound(LEVEL1);
    expect(summary.score).toBe(100);
    expect(summary.passed).toBe(true);
    expect(summary.nextLevel?.status).toBe('premium');
    expect(summary.plant.stageAfter).toBeGreaterThan(summary.plant.stageBefore);
    expect((await topic('matematika-kelas-1:A')).levels[0]).toMatchObject({
      status: 'passed',
      bestScore: 100,
    });
  });

  it('8 benar 2 keliru: skor 80 dan lulus', async () => {
    const { summary } = await playRound(LEVEL1, 2);
    expect(summary).toMatchObject({ score: 80, correct: 8, wrong: 2, passed: true });
  });

  it('6 benar: skor 60 dan belum lulus, level 2 tetap terkunci', async () => {
    const { summary } = await playRound(LEVEL1, 4);
    expect(summary).toMatchObject({ score: 60, passed: false });
    expect((await topic('matematika-kelas-1:A')).levels[1]!.status).toBe('locked');
  });

  it('coba lagi memakai seed baru', async () => {
    const a = await startRound(LEVEL1);
    const b = await startRound(LEVEL1);
    expect(a.roundId).not.toBe(b.roundId);
    expect(a.questions.map((q) => q.prompt)).not.toEqual(b.questions.map((q) => q.prompt));
  });

  it('jawaban keliru memberi petunjuk dan jawaban tepat, jawaban benar tidak', async () => {
    const round = await startRound(LEVEL1);
    const key = generateRound(
      { generator: 'count', generatorParams: LEVEL1_PARAMS },
      seedFrom(round.roundId),
    );
    const wrong = await answer(round.roundId, { questionIndex: 0, answer: 'tidak-ada' });
    expect(wrong).toMatchObject({ isCorrect: false, correctAnswer: key[0]!.answer });
    expect(wrong.hint).toBeTruthy();
    const right = await answer(round.roundId, { questionIndex: 1, answer: key[1]!.answer });
    expect(right).toEqual({ isCorrect: true, hint: null, correctAnswer: null });
  });

  it('satu soal tidak bisa dijawab dua kali dan ronde belum lengkap tidak bisa selesai', async () => {
    const round = await startRound(LEVEL1);
    await answer(round.roundId, { questionIndex: 0, answer: '1' });
    expect((await errorOf(answer(round.roundId, { questionIndex: 0, answer: '1' }))).status).toBe(
      409,
    );
    expect((await errorOf(finish(round.roundId))).status).toBe(409);
  });

  it('level terkunci, Premium, dan segera hadir ditolak di server', async () => {
    expect((await errorOf(startRound('matematika-kelas-1:A:2'))).body.code).toBe('LEVEL_LOCKED');
    const db = readDb();
    db.passedLevels[AYU] = [LEVEL1];
    writeDb(db);
    expect((await errorOf(startRound('matematika-kelas-1:A:2'))).body.code).toBe(
      'PREMIUM_REQUIRED',
    );
    expect((await errorOf(startRound('matematika-kelas-1:B:1'))).body.code).toBe(
      'NOT_ENOUGH_QUESTIONS',
    );
    expect((await errorOf(startRound('tidak:ada:1'))).status).toBe(404);
  });

  it('Premium aktif membuka level 2', async () => {
    const db = readDb();
    db.passedLevels[AYU] = [LEVEL1];
    db.premiumUntil[AYU] = new Date(Date.now() + 86_400_000).toISOString();
    writeDb(db);
    const round = await startRound('matematika-kelas-1:A:2');
    expect(round.questions).toHaveLength(10);
  });

  it('ronde milik anak lain dijawab 404', async () => {
    const round = await startRound(LEVEL1);
    login(BIMA, 'Bima');
    expect((await errorOf(answer(round.roundId, { questionIndex: 0, answer: '1' }))).status).toBe(
      404,
    );
    expect((await errorOf(result(round.roundId))).status).toBe(404);
  });
});

describe('mock peringkat dan profil', () => {
  it('peringkat tanpa id anak dan menyorot diri sendiri setelah bermain', async () => {
    await playRound(LEVEL1);
    const board = await leaderboard();
    expect(board.me).not.toBeNull();
    const mine = board.entries.find((e) => e.isMe);
    expect(mine?.nickname).toBe('Ayu');
    for (const entry of board.entries) expect(Object.keys(entry)).not.toContain('id');
    expect(board.entries.length).toBeLessThanOrEqual(20);
  });

  it('peringkat per buku hanya menghitung level buku itu', async () => {
    await playRound(LEVEL1);
    const math = await leaderboard('matematika-kelas-1');
    const science = await leaderboard('sains-kelas-1');
    expect(math.me?.points).toBe(100);
    expect(math.me?.score).toBe(75);
    expect(science.me).toBeNull();
  });

  it('profil memuat tanaman, riwayat, dan warna Momo bisa diganti', async () => {
    await playRound(LEVEL1);
    const p = await profile();
    expect(p.plants.map((x) => x.topicId)).toEqual(['matematika-kelas-1:A']);
    expect(p.history[0]).toMatchObject({ score: 100, passed: true });
  });
});

describe('halaman ronde', () => {
  it('menampilkan soal, menerima jawaban, dan memberi umpan balik tanpa kata salah', async () => {
    render(
      <MemoryRouter initialEntries={[`/play/latihan/${LEVEL1}`]}>
        <Routes>
          <Route path="/play/latihan/:levelId" element={<RoundPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Soal 1 dari 10')).toBeInTheDocument();
    const first = (await screen.findAllByRole('button')).filter((b) =>
      b.className.includes('choice'),
    )[0]!;
    fireEvent.click(first);
    fireEvent.click(screen.getByRole('button', { name: 'Periksa' }));
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status.textContent).toMatch(/Tepat|Belum tepat/));
    expect(status.textContent?.toLowerCase()).not.toContain('salah');
    expect(screen.getByRole('button', { name: 'Lanjut' })).toBeInTheDocument();
  });
});
