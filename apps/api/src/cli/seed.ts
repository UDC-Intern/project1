import '../common/env.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  bookContentSchema,
  billingContentSchema,
  DEFAULT_SETTINGS,
  emailSchema,
  passwordSchema,
  whatsappFromPhone,
  type BookContent,
} from '@udakids/engine';
import { contentDir, DEFAULT_DATABASE_URL } from '../common/config.js';
import { hashSecret } from '../common/crypto.js';
import type { Db } from '../db/db.module.js';
import * as s from '../db/schema.js';

export async function seed(db: Db) {
  const folder = contentDir();
  const dirs = await readdir(folder, { withFileTypes: true });
  const books: BookContent[] = [];
  for (const dir of dirs.filter((d) => d.isDirectory())) {
    books.push(
      bookContentSchema.parse(
        JSON.parse(await readFile(join(folder, dir.name, 'book.json'), 'utf8')),
      ),
    );
  }
  const billing = billingContentSchema.parse(
    JSON.parse(await readFile(join(folder, 'billing.json'), 'utf8')),
  );
  const password = process.env.ADMIN_PASSWORD;
  const passwordHash = password ? await hashSecret(passwordSchema.parse(password)) : null;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7177001)`);
    for (const b of books) {
      await tx
        .insert(s.books)
        .values({
          slug: b.slug,
          grade: Number(b.grade.replace(/\D/g, '')),
          subject: b.subject,
          title: b.title,
          sort: b.sort,
        })
        .onConflictDoNothing();
      for (const t of b.topics) {
        const id = `${b.slug}:${t.code}`;
        await tx
          .insert(s.topics)
          .values({
            id,
            bookSlug: b.slug,
            code: t.code,
            title: t.title,
            sort: t.sort,
            lesson: t.lesson,
            tips: t.tips ?? [],
          })
          .onConflictDoNothing();
        for (const l of t.levels) {
          const levelId = `${id}:${l.number}`;
          await tx
            .insert(s.levels)
            .values({
              id: levelId,
              topicId: id,
              number: l.number,
              title: l.title,
              generator: l.generator,
              generatorParams: l.generatorParams,
            })
            .onConflictDoNothing();
          await tx
            .update(s.levels)
            .set({ generator: l.generator, generatorParams: l.generatorParams ?? null })
            .where(sql`${s.levels.id} = ${levelId} and ${s.levels.custom} = false`);
        }
      }
    }
    if (!(await tx.select({ id: s.billingPackages.id }).from(s.billingPackages).limit(1)).length)
      await tx.insert(s.billingPackages).values(billing.packages);
    if (!(await tx.select({ id: s.paymentMethods.id }).from(s.paymentMethods).limit(1)).length)
      await tx.insert(s.paymentMethods).values(billing.methods);
    for (const [key, original] of Object.entries(DEFAULT_SETTINGS)) {
      const value =
        key === 'contact'
          ? {
              ...DEFAULT_SETTINGS.contact,
              adminWhatsapp: whatsappFromPhone(process.env.ADMIN_WHATSAPP ?? billing.adminWhatsapp),
            }
          : original;
      await tx.insert(s.appSettings).values({ key, value }).onConflictDoNothing();
    }
    await tx
      .insert(s.appSettings)
      .values({ key: 'certificateDesign', value: 'klasik' })
      .onConflictDoNothing();
    if (
      !(
        await tx
          .select({ id: s.staffUsers.id })
          .from(s.staffUsers)
          .where(eq(s.staffUsers.role, 'admin'))
          .limit(1)
      ).length
    ) {
      if (!passwordHash) throw new Error('ADMIN_PASSWORD wajib diisi untuk membuat admin pertama.');
      await tx.insert(s.staffUsers).values({
        name: 'Admin',
        email: emailSchema.parse(process.env.ADMIN_EMAIL ?? 'admin@udakids.local'),
        passwordHash,
      });
    }
  });
  return {
    books: books.length,
    topics: books.reduce((n, b) => n + b.topics.length, 0),
    levels: books.reduce((n, b) => n + b.topics.reduce((a, t) => a + t.levels.length, 0), 0),
  };
}

export async function runSeed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
  try {
    console.log(await seed(drizzle(pool, { schema: s })));
  } finally {
    await pool.end();
  }
}
if (require.main === module)
  void runSeed().catch(() => {
    console.error('Seed belum berhasil. Periksa database dan konfigurasi admin.');
    process.exitCode = 1;
  });
