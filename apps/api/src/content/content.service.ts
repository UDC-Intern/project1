import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  bankFromGenerator,
  bankFromLevel,
  bankToLevel,
  bookInputSchema,
  bookSlugOf,
  checkChildText,
  generateRound,
  isFreeLevel,
  levelInputSchema,
  levelSource,
  MAX_LEVELS_PER_TOPIC,
  MAX_TOPICS_PER_BOOK,
  nextTopicCode,
  questionBankSchema,
  subjectCodeOf,
  topicInputSchema,
  updateTopicBodySchema,
  type CatalogBook,
  type TopicInput,
} from '@udakids/engine';
import { DB, type Db, type Executor } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { CurriculumService, effective } from './curriculum.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { fail, missing } from '../common/errors.js';

@Injectable()
export class ContentService {
  constructor(
    @Inject(DB) private db: Db,
    private curriculum: CurriculumService,
    private settings: SettingsService,
  ) {}
  async catalog(tx: Executor = this.db): Promise<CatalogBook[]> {
    const [books, settings, usedRows] = await Promise.all([
      this.curriculum.books(tx),
      this.settings.get(tx),
      tx.select({ id: s.rounds.levelId }).from(s.rounds).groupBy(s.rounds.levelId),
    ]);
    const used = new Set(usedRows.map((r) => r.id));
    return books.map((b) => ({
      ...b,
      used: b.topics.some((t) => t.levels.some((l) => used.has(l.id))),
      topics: b.topics.map((t) => ({
        ...t,
        used: t.levels.some((l) => used.has(l.id)),
        levels: t.levels.map((l) => {
          const spec = effective(l);
          return {
            id: l.id,
            number: l.number,
            title: l.title,
            free:
              !settings.billing.paywall ||
              (l.freeOverride ?? isFreeLevel(l.number, settings.billing)),
            override: l.freeOverride !== null,
            generator: spec?.generator ?? null,
            source: spec ? levelSource(spec) : 'none',
            questions:
              l.bank?.length ??
              bankFromLevel({
                generator: l.generator,
                generatorParams: l.generatorParams ?? undefined,
              })?.length ??
              0,
            custom: l.custom,
            edited: !!l.bank && !l.custom,
            used: used.has(l.id),
          };
        }),
      })),
    }));
  }
  private async mutate(work: (tx: Executor) => Promise<void>) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7177003)`);
      await work(tx);
    });
    this.curriculum.invalidate();
    return this.catalog();
  }
  private async insertTopic(tx: Executor, bookSlug: string, input: TopicInput) {
    const existing = await tx
      .select({ code: s.topics.code })
      .from(s.topics)
      .where(eq(s.topics.bookSlug, bookSlug));
    if (existing.length >= MAX_TOPICS_PER_BOOK)
      fail(409, 'CONFLICT', 'Satu buku paling banyak 60 topik.');
    const code = input.code?.toUpperCase() ?? nextTopicCode(existing.map((t) => t.code));
    const id = `${bookSlug}:${code}`;
    await tx.insert(s.topics).values({
      id,
      bookSlug,
      code,
      title: input.title,
      lesson: input.lesson,
      tips: input.tips,
      sort: existing.length + 1,
      custom: true,
    });
    await tx.insert(s.levels).values(
      input.levels.map((l, index) => ({
        id: `${id}:${index + 1}`,
        topicId: id,
        number: index + 1,
        title: l.title,
        custom: true,
      })),
    );
  }
  addBook(input: unknown) {
    const body = bookInputSchema.parse(input);
    return this.mutate(async (tx) => {
      const slug = bookSlugOf(body.subject, body.grade);
      await tx.insert(s.books).values({
        slug,
        grade: body.grade,
        subject: subjectCodeOf(body.subject),
        title: body.title,
        custom: true,
        sort: 100,
      });
      await this.insertTopic(tx, slug, body.topic);
    });
  }
  addTopic(slug: string, input: unknown) {
    const body = topicInputSchema.parse(input);
    return this.mutate(async (tx) => {
      if (!(await tx.select().from(s.books).where(eq(s.books.slug, slug))).length) missing();
      await this.insertTopic(tx, slug, body);
    });
  }
  addLevel(id: string, input: unknown) {
    const body = levelInputSchema.parse(input);
    return this.mutate(async (tx) => {
      const [topic] = await tx.select().from(s.topics).where(eq(s.topics.id, id));
      if (!topic) missing();
      const levels = await tx.select().from(s.levels).where(eq(s.levels.topicId, id));
      if (levels.length >= MAX_LEVELS_PER_TOPIC)
        fail(409, 'CONFLICT', 'Satu topik paling banyak 12 level.');
      const number = Math.max(0, ...levels.map((l) => l.number)) + 1;
      await tx
        .insert(s.levels)
        .values({ id: `${id}:${number}`, topicId: id, number, title: body.title, custom: true });
    });
  }
  updateTopic(id: string, input: unknown) {
    const body = updateTopicBodySchema.parse(input);
    for (const text of [body.lesson, ...(body.tips ?? [])])
      if (text && checkChildText(text).length)
        fail(400, 'VALIDATION', 'Gunakan kalimat yang ramah anak.');
    return this.mutate(async (tx) => {
      if (!(await tx.update(s.topics).set(body).where(eq(s.topics.id, id)).returning()).length)
        missing();
    });
  }
  updateLevel(id: string, input: unknown) {
    const body = z
      .object({
        title: z.string().trim().min(1).max(60).optional(),
        free: z.boolean().optional(),
        isFree: z.boolean().optional(),
      })
      .parse(input);
    return this.mutate(async (tx) => {
      const [level] = await tx.select().from(s.levels).where(eq(s.levels.id, id));
      if (!level) missing();
      const free = body.free ?? body.isFree;
      const settings = await this.settings.get(tx);
      if (level.number === 1 && free === false)
        fail(400, 'VALIDATION', 'Level pertama selalu gratis.');
      await tx
        .update(s.levels)
        .set({
          title: body.title,
          ...(free !== undefined && {
            freeOverride: free === isFreeLevel(level.number, settings.billing) ? null : free,
          }),
        })
        .where(eq(s.levels.id, id));
    });
  }
  remove(kind: 'book' | 'topic' | 'level', id: string) {
    return this.mutate(async (tx) => {
      const catalog = await this.catalog(tx);
      const book =
        kind === 'book'
          ? catalog.find((b) => b.slug === id)
          : catalog.find((b) =>
              b.topics.some((t) =>
                kind === 'topic' ? t.id === id : t.levels.some((l) => l.id === id),
              ),
            );
      if (!book) missing();
      const topic = book.topics.find((t) =>
        kind === 'topic' ? t.id === id : t.levels.some((l) => l.id === id),
      );
      const level = topic?.levels.find((l) => l.id === id);
      const item = kind === 'book' ? book : kind === 'topic' ? topic : level;
      if (!item) missing();
      if (!item.custom || item.used)
        fail(409, 'CONFLICT', 'Konten bawaan atau yang sudah dikerjakan tidak bisa dihapus.');
      if (
        kind === 'level' &&
        (topic!.levels.length <= 1 ||
          level!.number !== Math.max(...topic!.levels.map((l) => l.number)))
      )
        fail(
          409,
          'CONFLICT',
          'Hanya level paling akhir yang bisa dihapus, dengan minimal satu level tersisa.',
        );
      if (kind === 'book') await tx.delete(s.books).where(eq(s.books.slug, id));
      else if (kind === 'topic') await tx.delete(s.topics).where(eq(s.topics.id, id));
      else await tx.delete(s.levels).where(eq(s.levels.id, id));
    });
  }
  async questions(id: string, from?: string, seed = 1) {
    const { level } = await this.curriculum.find(id);
    const base = {
      generator: level.generator,
      generatorParams: level.generatorParams ?? undefined,
    };
    const regenerable = !!level.generator && levelSource(base) === 'auto';
    if (from === 'generator' && !regenerable)
      fail(409, 'CONFLICT', 'Level ini tidak punya soal otomatis.');
    const bank = level.bank ? questionBankSchema.parse(level.bank) : bankFromLevel(base);
    return {
      items:
        from === 'generator'
          ? bankFromGenerator(base, { seed })
          : (bank ?? (regenerable ? bankFromGenerator(base, { seed }) : [])),
      min: 4,
      good: 10,
      max: 60,
      draft: from === 'generator' || (!bank && regenerable),
      edited: !!level.bank && !level.custom,
      regenerable,
    };
  }
  saveQuestions(id: string, input: unknown) {
    const body = z.object({ items: questionBankSchema }).parse(input);
    generateRound(bankToLevel(body.items), 1);
    return this.mutate(async (tx) => {
      if (
        !(
          await tx.update(s.levels).set({ bank: body.items }).where(eq(s.levels.id, id)).returning()
        ).length
      )
        missing();
    });
  }
  clearQuestions(id: string) {
    return this.mutate(async (tx) => {
      const { level } = await this.curriculum.find(id, tx);
      if (!level.bank) fail(409, 'CONFLICT', 'Level ini belum disesuaikan.');
      if (
        level.custom &&
        (
          await tx
            .select({ id: s.rounds.id })
            .from(s.rounds)
            .where(eq(s.rounds.levelId, id))
            .limit(1)
        ).length
      )
        fail(409, 'CONFLICT', 'Level ini sudah dikerjakan anak.');
      await tx.update(s.levels).set({ bank: null }).where(eq(s.levels.id, id));
    });
  }
  async usage() {
    const counts: Record<string, number> = {};
    for (const b of await this.curriculum.books())
      for (const t of b.topics)
        for (const l of t.levels) {
          const spec = effective(l);
          if (!spec) continue;
          const items = new Set<string>();
          for (const seed of [1, 7, 42])
            for (const q of generateRound(spec, seed)) {
              if (q.visual && q.visual.kind !== 'image') items.add(q.visual.item);
            }
          for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
        }
    return { objects: counts };
  }
}
