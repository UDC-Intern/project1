import {
  FOREVER_ISO,
  PIN_PICTURES,
  type ChildInsights,
  type DayActivity,
  type Order as OwnOrder,
  type PlanStatus,
} from '@udakids/engine';
import { ApiError } from '../client';
import * as account from './account';
import { parentFromToken } from './accounts';
import * as billing from './billing';
import * as certificates from './certificate';
import { BOOKS, gradeOf, premiumUntilOf, readDb, topicId, type MockChild, type MockDb } from './db';
import * as parent from './parent';
import { isLevelFree } from './settings';

/**
 * Pintu masuk data tiruan untuk halaman area orang tua: alamat dan bentuk respons mengikuti
 * kontrak yang dipakai halaman itu, lalu diteruskan ke modul tiruan yang sudah ada.
 */

const DAY_MS = 86_400_000;
const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

function foundLevel(levelId: string) {
  const [slug, code, n] = levelId.split(':');
  const book = BOOKS.find((b) => b.slug === slug);
  const topic = book?.topics.find((t) => t.code === code);
  const level = topic?.levels.find((l) => String(l.number) === n);
  return book && topic && level ? { book, topic, level } : null;
}

const asPin = (value: unknown) =>
  Array.isArray(value) && value.every((p) => (PIN_PICTURES as readonly unknown[]).includes(p))
    ? (value as [
        (typeof PIN_PICTURES)[number],
        (typeof PIN_PICTURES)[number],
        (typeof PIN_PICTURES)[number],
      ])
    : undefined;

function planOf(db: MockDb, child: MockChild): PlanStatus {
  const until = premiumUntilOf(db, child.id);
  if (!until) return { tier: 'free', endsAt: null, source: null };
  const forever = until.startsWith('9999');
  return {
    tier: 'premium',
    endsAt: forever ? null : until,
    source: db.familyPremium[child.parentId] === until ? 'purchase' : 'admin',
  };
}

function finished(db: MockDb, childId: string) {
  return Object.values(db.rounds)
    .filter((r) => r.childId === childId && r.result && r.finishedAt)
    .sort((a, b) => b.finishedAt! - a.finishedAt!);
}

function insightsOf(db: MockDb, child: MockChild, now = Date.now()): ChildInsights {
  const rounds = finished(db, child.id);
  const best = db.best[child.id] ?? {};
  const passedIds = db.passedLevels[child.id] ?? [];
  const premium = premiumUntilOf(db, child.id) !== null;

  const week: DayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = dayKey(now - i * DAY_MS);
    const day = rounds.filter((r) => dayKey(r.finishedAt!) === date);
    week.push({
      date,
      rounds: day.length,
      passed: day.filter((r) => r.result!.passed).length,
      minutes: Math.round(day.reduce((a, r) => a + r.result!.durationMs, 0) / 60_000),
    });
  }
  const average = (list: typeof rounds) =>
    list.length ? Math.round(list.reduce((a, r) => a + r.result!.score, 0) / list.length) : null;
  const thisWeek = rounds.filter((r) => r.finishedAt! > now - 7 * DAY_MS);
  const before = rounds.filter(
    (r) => r.finishedAt! <= now - 7 * DAY_MS && r.finishedAt! > now - 14 * DAY_MS,
  );
  const nowAvg = average(thisWeek);

  // Level berikutnya: yang pertama belum lulus, berurutan per topik.
  let next: ChildInsights['next'] = null;
  for (const book of BOOKS) {
    for (const topic of book.topics) {
      const lvl = topic.levels.find(
        (l) => !passedIds.includes(`${book.slug}:${topic.code}:${l.number}`),
      );
      if (lvl && lvl.generator !== null) {
        next = {
          level: lvl.number,
          topic: topic.title,
          book: book.title,
          paid:
            !isLevelFree(db, `${book.slug}:${topic.code}:${lvl.number}`, lvl.number) && !premium,
        };
        break;
      }
    }
    if (next) break;
  }

  // Topik terkuat dan yang perlu ditemani, dari skor terbaik per level.
  const perTopic = new Map<string, { title: string; scores: number[] }>();
  for (const [levelId, v] of Object.entries(best)) {
    const f = foundLevel(levelId);
    if (!f) continue;
    const key = topicId(f.book.slug, f.topic.code);
    const cur = perTopic.get(key) ?? { title: f.topic.title, scores: [] };
    cur.scores.push(v.score);
    perTopic.set(key, cur);
  }
  const strongest = [...perTopic.values()]
    .map((t) => ({
      topic: t.title,
      best: Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length),
    }))
    .sort((a, b) => b.best - a.best)[0];

  const attempts = new Map<string, number>();
  for (const r of rounds) attempts.set(r.levelId, (attempts.get(r.levelId) ?? 0) + 1);
  const struggling = [...attempts.entries()]
    .filter(([id, n]) => n >= 2 && !passedIds.includes(id))
    .map(([id, n]) => ({ id, n, score: best[id]?.score ?? 0 }))
    .sort((a, b) => a.score - b.score)[0];
  const focusLevel = struggling ? foundLevel(struggling.id) : null;

  return {
    totals: {
      points: Object.values(best).reduce((a, b) => a + b.score, 0),
      passed: passedIds.length,
      played: rounds.length,
      answered: rounds.reduce((a, r) => a + Object.keys(r.answers).length, 0),
      timeMs: rounds.reduce((a, r) => a + r.result!.durationMs, 0),
    },
    week,
    weekRounds: week.reduce((a, d) => a + d.rounds, 0),
    weekPassed: week.reduce((a, d) => a + d.passed, 0),
    weekMinutes: week.reduce((a, d) => a + d.minutes, 0),
    activeDays: week.filter((d) => d.rounds > 0).length,
    trend: nowAvg === null ? null : { now: nowAvg, before: average(before) },
    next,
    strength: strongest ? { topic: strongest.topic, best: strongest.best } : null,
    focus:
      struggling && focusLevel
        ? {
            topic: focusLevel.topic.title,
            level: focusLevel.level.number,
            best: struggling.score,
            attempts: struggling.n,
          }
        : null,
    books: BOOKS.map((b) => {
      const levels = b.topics.reduce((n, t) => n + t.levels.length, 0);
      const passed = b.topics.reduce(
        (n, t) =>
          n + t.levels.filter((l) => passedIds.includes(`${b.slug}:${t.code}:${l.number}`)).length,
        0,
      );
      return {
        slug: b.slug,
        domain: b.subject === 'science' ? 'sains' : 'math',
        grade: `sd${gradeOf(b.slug)}`,
        title: b.title,
        percent: levels ? Math.round((passed / levels) * 100) : 0,
        passed,
        levels,
        certificateId: certificates.certificateOf(db, child.id, b.slug)?.id ?? null,
      };
    }),
    recent: rounds.slice(0, 5).map((r) => {
      const f = foundLevel(r.levelId);
      return {
        skillId: r.levelId,
        ts: r.finishedAt!,
        score: r.result!.score,
        passed: r.result!.passed,
        level: f?.level.number ?? 1,
        title: f?.topic.title ?? r.levelId,
        book: f?.book.title ?? '',
        durationMs: r.result!.durationMs,
      };
    }),
  };
}

function profileOf(db: MockDb, child: MockChild) {
  const last = finished(db, child.id)[0];
  return {
    id: child.id,
    nickname: child.nickname,
    momoColor: child.momoColor,
    classId: null,
    className: null,
    classCode: null,
    lastActiveAt: last ? new Date(last.finishedAt!).toISOString() : null,
    createdAt: child.createdAt ?? new Date(0).toISOString(),
    certificateName: child.certificateName ?? null,
  };
}

/** Pesanan dalam bentuk halaman (dipakai juga panel admin). */
export const orderView = (o: OwnOrder, kind: 'bank' | 'ewallet', mime: string | null) => ({
  id: o.id,
  number: o.number,
  packageId: o.packageId,
  packageSnapshot: {
    name: o.packageName,
    scope: 'all' as const,
    books: [] as { domain: string; grade: string }[],
    durationDays: o.durationDays,
  },
  methodSnapshot: {
    kind,
    provider: o.methodName,
    accountNumber: o.methodNumber,
    accountName: o.methodHolder,
    instructions: '',
  },
  priceNormal: o.listPrice,
  discount: o.discount,
  uniqueCode: o.uniqueCode,
  amount: o.total,
  status: o.status,
  expiresAt: o.expiresAt,
  proofMime: mime,
  proofAt: o.proofAt,
  reviewedAt: o.paidAt,
  note: o.rejectNote,
  createdAt: o.createdAt,
});

async function ordersOf(token: string | null) {
  const [list, methods] = await Promise.all([billing.orders(token), billing.methods(token)]);
  const db = readDb();
  const kindOf = (id: string) => methods.find((m) => m.id === id)?.kind ?? 'bank';
  const mimeOf = (id: string) => {
    const m = /^data:([^;]+);/.exec(db.orders[id]?.proofDataUrl ?? '');
    return m ? m[1]! : null;
  };
  return list.map((o) => orderView(o, kindOf(o.methodId), mimeOf(o.id)));
}

const accountView = (a: Awaited<ReturnType<typeof account.account>>) => ({
  ...a,
  mustChangePassword: false,
});

const notFound = () => new ApiError(404, { code: 'NOT_FOUND', message: 'Data tidak ketemu.' });

type Body = Record<string, unknown>;

/** Memetakan alamat ke fungsi tiruan. Alamat yang tidak dikenal dijawab 404. */
export async function handle<T>(
  path: string,
  method: string,
  body: Body | undefined,
  token: string | null,
): Promise<T> {
  const url = path.split('?')[0]!;
  const seg = url.split('/').filter(Boolean);
  const send = (value: unknown) => value as T;

  if (url === '/auth/me') {
    const p = parentFromToken(token);
    return send({ id: p.id, name: p.name, familyCode: p.familyCode });
  }

  if (url === '/catalog') {
    return send({
      catalogs: BOOKS.map((b) => ({
        domain: b.subject === 'science' ? 'sains' : 'math',
        grade: 'sd1',
        title: b.title,
      })),
    });
  }

  if (seg[0] === 'parent' && seg[1] === 'children') {
    const db = readDb();
    const me = parentFromToken(token);
    if (seg.length === 2 && method === 'GET') {
      return send(db.children.filter((c) => c.parentId === me.id).map((c) => profileOf(db, c)));
    }
    if (seg.length === 2 && method === 'POST') {
      const created = await parent.createChild(token, {
        nickname: String(body?.nickname ?? ''),
        momoColor: body?.momoColor as never,
      });
      const pin = asPin(body?.pin);
      if (pin) await parent.setPin(token, created.id, pin);
      const next = readDb();
      return send(
        profileOf(
          next,
          next.children.find((c) => c.id === created.id)!,
        ),
      );
    }
    const id = seg[2]!;
    if (seg.length === 3 && method === 'PATCH') {
      const patch: { nickname?: string; momoColor?: never } = {};
      if (typeof body?.nickname === 'string') patch.nickname = body.nickname;
      if (typeof body?.momoColor === 'string') patch.momoColor = body.momoColor as never;
      if (Object.keys(patch).length > 0) await parent.updateChild(token, id, patch);
      const pin = asPin(body?.pin);
      if (pin) await parent.setPin(token, id, pin);
      if (typeof body?.certificateName === 'string')
        await parent.setCertificateName(
          token,
          id,
          body.certificateName,
          body.certificateConsent === true,
        );
      const next = readDb();
      const child = next.children.find((c) => c.id === id && c.parentId === me.id);
      if (!child) throw notFound();
      return send(profileOf(next, child));
    }
    if (seg.length === 3 && method === 'DELETE') {
      await parent.deleteChild(token, id);
      return send(undefined);
    }
  }

  if (url === '/parent/overview' && method === 'GET') {
    const db = readDb();
    const me = parentFromToken(token);
    return send({
      children: db.children
        .filter((c) => c.parentId === me.id)
        .map((c) => ({
          ...profileOf(db, c),
          plan: planOf(db, c),
          insights: insightsOf(db, c),
        })),
    });
  }

  if (url === '/parent/billing' && method === 'GET') {
    const [pkgs, methods] = await Promise.all([billing.packages(token), billing.methods(token)]);
    const db = readDb();
    const me = parentFromToken(token);
    const until = db.familyPremium[me.id];
    const forever = until?.startsWith('9999') ?? false;
    const paid = Object.values(db.orders)
      .filter((o) => o.parentId === me.id && o.status === 'paid')
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))[0];
    return send({
      packages: pkgs.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        scope: 'all',
        books: [],
        durationDays: p.durationDays,
        pricing: {
          normal: p.listPrice,
          final: p.price,
          discount: p.listPrice - p.price,
          discountActive: p.listPrice > p.price,
        },
        discountEndsAt: null,
      })),
      methods: methods.map((m) => ({
        id: m.id,
        kind: m.kind,
        provider: m.name,
        accountNumber: m.number,
        accountName: m.holder,
        instructions: m.instructions ?? '',
      })),
      entitlements: until
        ? [
            {
              id: `ent-${me.id}`,
              name: paid?.packageName ?? 'Premium',
              scope: 'all',
              books: [],
              startsAt: paid?.paidAt ?? new Date().toISOString(),
              endsAt: forever || until === FOREVER_ISO ? null : until,
            },
          ]
        : [],
      access: { tier: until ? 'premium' : 'free', endsAt: forever ? null : (until ?? null) },
      settings: db.settings.billing,
    });
  }

  if (seg[0] === 'parent' && seg[1] === 'orders') {
    if (seg.length === 2 && method === 'GET') return send(await ordersOf(token));
    if (seg.length === 2 && method === 'POST') {
      const created = await billing.createOrder(token, {
        packageId: String(body?.packageId ?? ''),
        methodId: String(body?.methodId ?? ''),
      });
      return send((await ordersOf(token)).find((o) => o.id === created.id));
    }
    const id = seg[2]!;
    if (seg.length === 3 && method === 'GET') {
      const found = (await ordersOf(token)).find((o) => o.id === id);
      if (!found) throw notFound();
      return send(found);
    }
    if (seg.length === 4 && seg[3] === 'cancel' && method === 'POST') {
      await billing.cancelOrder(token, id);
      return send((await ordersOf(token)).find((o) => o.id === id));
    }
    if (seg.length === 4 && seg[3] === 'proof' && method === 'PUT') {
      await billing.uploadProof(token, id, body as never);
      return send((await ordersOf(token)).find((o) => o.id === id));
    }
    if (seg.length === 4 && seg[3] === 'proof' && method === 'GET') {
      await billing.order(token, id);
      return send({ dataUrl: readDb().orders[id]?.proofDataUrl ?? null });
    }
  }

  if (seg[0] === 'parent' && seg[1] === 'certificates') {
    if (seg.length === 2 && method === 'GET')
      return send(await certificates.parentCertificates(token));
    if (seg.length === 2 && method === 'POST')
      return send(
        await certificates.parentClaim(token, {
          childId: String(body?.childId ?? ''),
          bookSlug: String(body?.bookSlug ?? ''),
        }),
      );
    if (seg.length === 3 && method === 'GET')
      return send(await certificates.parentCertificate(token, decodeURIComponent(seg[2]!)));
  }

  if (seg[0] === 'parent' && seg[1] === 'account') {
    if (seg.length === 2 && method === 'GET')
      return send(accountView(await account.account(token)));
    if (seg.length === 2 && method === 'PATCH') {
      return send(accountView(await account.updateName(token, String(body?.name ?? ''))));
    }
    if (seg[2] === 'email' && seg.length === 3) {
      const res = await account.requestEmailChange(token, {
        email: String(body?.email ?? ''),
        currentPassword: String(body?.currentPassword ?? ''),
      });
      return send({ pendingEmail: res.pendingEmail, mockCode: account.MOCK_EMAIL_CODE });
    }
    if (seg[2] === 'email' && seg[3] === 'verify') {
      return send(accountView(await account.confirmEmailChange(token, String(body?.code ?? ''))));
    }
    if (seg[2] === 'password') {
      await account.changePassword(token, {
        currentPassword: String(body?.currentPassword ?? ''),
        newPassword: String(body?.password ?? ''),
      });
      const me = parentFromToken(token);
      return send({ token, user: { id: me.id, role: 'parent', name: me.name } });
    }
  }

  throw notFound();
}
