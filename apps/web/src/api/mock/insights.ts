import {
  generateRound,
  mulberry32,
  seedFrom,
  type AdminInsights,
  type InsightRange,
  type MomoColor,
} from '@udakids/engine';
import { adminFromToken } from './staff';
import { BOOKS, readDb, type MockDb, type MockRound } from './db';
import { findLevel } from './levels';

const DAY = 24 * 60 * 60 * 1000;
const HOURS = 24; // 00.00 sampai 23.59 WIB
const FIRST_HOUR = 0;
/** Di bawah jumlah ronde ini, grafik memakai data contoh supaya dasbor tetap terbaca. */
const MIN_REAL_ROUNDS = 8;

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function daysOf(range: InsightRange, now: number): string[] {
  const count = range === '7d' ? 7 : range === '30d' ? 30 : new Date(now).getUTCDate();
  return Array.from({ length: count }, (_, i) => dayKey(now - (count - 1 - i) * DAY));
}

/** Soal ronde dibuat ulang sekali per level + seed (data contoh berisi ribuan ronde). */
const questionCache = new Map<string, ReturnType<typeof generateRound>>();

function questionOf(round: MockRound, index: number) {
  const key = `${round.levelId}|${round.seed}`;
  let questions = questionCache.get(key);
  if (!questions) {
    const found = findLevel(round.levelId);
    if (!found?.level.generator) return null;
    questions = generateRound(
      {
        generator: found.level.generator,
        generatorParams: found.level.generatorParams as Record<string, unknown> | undefined,
      },
      round.seed,
    );
    if (questionCache.size > 20_000) questionCache.clear();
    questionCache.set(key, questions);
  }
  return questions[index];
}

function real(db: MockDb, days: string[]) {
  const from = Date.parse(`${days[0]}T00:00:00Z`);
  const rounds = Object.values(db.rounds).filter((r) => r.result && (r.finishedAt ?? 0) >= from);
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  const activity = days.map((date) => ({ date, rounds: 0, answers: 0 }));
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: HOURS }, () => 0));
  const heatmapKids = Array.from({ length: 7 }, () =>
    Array.from({ length: HOURS }, () => new Set<string>()),
  );
  const skills = new Map<string, { title: string; right: number; total: number }>();
  const distractors = new Map<string, { prompt: string; chosen: string; count: number }>();
  const subjects = new Map<string, number>();
  let right = 0;
  let total = 0;

  for (const r of rounds) {
    const finished = r.finishedAt ?? 0;
    const idx = dayIndex.get(dayKey(finished));
    const answers = Object.entries(r.answers);
    if (idx !== undefined) {
      activity[idx]!.rounds += 1;
      activity[idx]!.answers += answers.length;
    }
    // Hari dan jam dibaca dalam WIB: ronde pukul 00.30 WIB hari Selasa jatuh di baris Selasa, kolom 00.
    const wib = new Date(finished + 7 * 60 * 60 * 1000);
    const weekday = (wib.getUTCDay() + 6) % 7;
    const slot = wib.getUTCHours() - FIRST_HOUR;
    if (slot >= 0 && slot < HOURS) {
      heatmap[weekday]![slot]! += 1;
      heatmapKids[weekday]![slot]!.add(r.childId);
    }

    const found = findLevel(r.levelId);
    if (found) {
      const entry = skills.get(r.levelId) ?? { title: found.level.title, right: 0, total: 0 };
      subjects.set(found.bookTitle, (subjects.get(found.bookTitle) ?? 0) + 1);
      for (const [i, a] of answers) {
        entry.total += 1;
        total += 1;
        if (a.isCorrect) {
          entry.right += 1;
          right += 1;
        } else {
          const q = questionOf(r, Number(i));
          if (q) {
            const key = `${q.prompt}|${a.chosen}`;
            const d = distractors.get(key) ?? { prompt: q.prompt, chosen: a.chosen, count: 0 };
            d.count += 1;
            distractors.set(key, d);
          }
        }
      }
      skills.set(r.levelId, entry);
    }
  }

  const heatmapChildren = heatmapKids.map((row) => row.map((kids) => kids.size));
  return {
    rounds,
    activity,
    heatmap,
    heatmapChildren,
    skills,
    distractors,
    subjects,
    right,
    total,
  };
}

function sampleInsights(
  days: string[],
): Pick<
  AdminInsights,
  | 'activity'
  | 'revenueSeries'
  | 'heatmap'
  | 'heatmapChildren'
  | 'hardestSkills'
  | 'popularDistractors'
  | 'subjects'
  | 'live'
> & { accuracy: number } {
  const rand = mulberry32(seedFrom(days.join(',')));
  const activity = days.map((date) => {
    const rounds = 4 + Math.floor(rand() * 14);
    return { date, rounds, answers: rounds * 10 };
  });
  const revenueSeries = days.map((date) => ({
    date,
    amount: rand() > 0.55 ? [17500, 37500, 63000][Math.floor(rand() * 3)]! : 0,
  }));
  // Anak berlatih sepulang sekolah (15.00 sampai 20.59) dan sedikit di pagi hari; dini hari nyaris sepi.
  const heatmap = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: HOURS }, (_, h) => {
      const peak = h >= 15 && h <= 20 ? 6 : h >= 7 && h <= 11 ? 3 : 0;
      const awake = h >= 5 && h <= 21;
      const weekend = awake && d >= 5 ? 2 : 0;
      const noise = Math.floor(rand() * (awake ? 4 : 2));
      return noise + peak + weekend;
    }),
  );
  // Perkiraan: satu anak rata-rata menyelesaikan sekitar dua ronde dalam satu jam.
  const heatmapChildren = heatmap.map((row) =>
    row.map((n) => (n === 0 ? 0 : Math.max(1, Math.round(n / 2.4)))),
  );
  const levels = BOOKS.flatMap((b) =>
    b.topics.flatMap((t) =>
      t.levels.filter((l) => l.generator !== null).map((l) => `${t.title}: ${l.title}`),
    ),
  );
  const hardestSkills = levels.slice(0, 5).map((title) => ({
    title,
    accuracy: 42 + Math.floor(rand() * 30),
    answers: 30 + Math.floor(rand() * 90),
  }));
  hardestSkills.sort((a, b) => a.accuracy - b.accuracy);

  const sampleRound = generateRound({ generator: 'count', generatorParams: { max: 20 } }, 11);
  const popularDistractors = sampleRound
    .filter((q) => q.options)
    .slice(0, 4)
    .map((q, i) => ({
      prompt: q.prompt,
      chosen: q.options!.find((o) => o !== q.answer) ?? '-',
      count: 14 - i * 3,
    }));

  return {
    activity,
    revenueSeries,
    heatmap,
    heatmapChildren,
    hardestSkills,
    popularDistractors,
    subjects: [
      { label: 'Matematika Kelas 1', value: 62 },
      { label: 'Sains Kelas 1', value: 38 },
    ],
    live: [
      { nickname: 'Rara', momoColor: 'pink' as MomoColor, level: 'Membilang 1 sampai 20' },
      { nickname: 'Dimas', momoColor: 'blue' as MomoColor, level: 'Nama bagian tubuh' },
    ],
    accuracy: 78,
  };
}

export async function insights(
  token: string | null,
  range: InsightRange = '7d',
): Promise<AdminInsights> {
  adminFromToken(token);
  const db = readDb();
  const now = Date.now();
  const days = daysOf(range, now);
  const r = real(db, days);
  const sample = r.rounds.length < MIN_REAL_ROUNDS;
  const demo = sample ? sampleInsights(days) : null;

  const revenueReal = days.map((date) => ({
    date,
    amount: Object.values(db.orders)
      .filter((o) => o.status === 'paid' && o.paidAt && dayKey(Date.parse(o.paidAt)) === date)
      .reduce((a, o) => a + o.price, 0),
  }));
  const revenueSeries =
    demo && revenueReal.every((x) => x.amount === 0) ? demo.revenueSeries : revenueReal;

  const activeIds = new Set(r.rounds.map((x) => x.childId));
  const payers = new Set(
    Object.values(db.orders)
      .filter((o) => o.status === 'paid')
      .map((o) => o.parentId),
  );
  const parentsWithKids = new Set(db.children.map((c) => c.parentId));
  const activeParents = new Set(
    db.children
      .filter((c) => Object.values(db.rounds).some((x) => x.childId === c.id && x.result))
      .map((c) => c.parentId),
  );

  const funnel = [
    { label: 'Mendaftar', value: db.parents.length },
    { label: 'Punya profil anak', value: parentsWithKids.size },
    { label: 'Anak berlatih', value: activeParents.size },
    { label: 'Langganan berbayar', value: payers.size },
  ];
  if (sample) {
    const base = Math.max(24, db.parents.length);
    funnel[0]!.value = base;
    funnel[1]!.value = Math.round(base * 0.78);
    funnel[2]!.value = Math.round(base * 0.55);
    funnel[3]!.value = Math.round(base * 0.18);
  }

  const kpisAnswered = sample ? demo!.activity.reduce((a, x) => a + x.answers, 0) : r.total;
  const live = Object.values(db.rounds)
    .filter((x) => !x.result && Date.now() - x.startedAt < 5 * 60_000)
    .map((x) => ({
      nickname: db.children.find((c) => c.id === x.childId)?.nickname ?? '-',
      momoColor: (db.children.find((c) => c.id === x.childId)?.momoColor ?? 'blue') as MomoColor,
      level: findLevel(x.levelId)?.level.title ?? x.levelId,
    }));

  return {
    range,
    sample,
    days,
    kpis: {
      activeChildren: sample ? Math.max(activeIds.size, 12) : activeIds.size,
      answered: kpisAnswered,
      accuracy: sample
        ? demo!.accuracy
        : r.total > 0
          ? Math.round((r.right / r.total) * 100)
          : null,
      revenue: revenueSeries.reduce((a, x) => a + x.amount, 0),
    },
    activity: sample ? demo!.activity : r.activity,
    revenueSeries,
    funnel,
    subjects: sample
      ? demo!.subjects
      : [...r.subjects.entries()].map(([label, value]) => ({ label, value })),
    heatmap: sample ? demo!.heatmap : r.heatmap,
    heatmapChildren: sample ? demo!.heatmapChildren : r.heatmapChildren,
    hardestSkills: sample
      ? demo!.hardestSkills
      : [...r.skills.values()]
          .filter((s) => s.total > 0)
          .map((s) => ({
            title: s.title,
            accuracy: Math.round((s.right / s.total) * 100),
            answers: s.total,
          }))
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 5),
    popularDistractors: sample
      ? demo!.popularDistractors
      : [...r.distractors.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    live: live.length > 0 || !sample ? live : demo!.live,
  };
}
