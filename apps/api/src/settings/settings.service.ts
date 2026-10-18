import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { appSettingsSchema, mergeSettings, type AppSettings } from '@udakids/engine';
import { DB, type Db, type Executor } from '../db/db.module.js';
import { appSettings, certificates, children } from '../db/schema.js';
import { missing } from '../common/errors.js';

@Injectable()
export class SettingsService {
  private cache?: { at: number; value: AppSettings };
  constructor(@Inject(DB) private db: Db) {}
  async get(tx: Executor = this.db): Promise<AppSettings> {
    if (tx === this.db && this.cache && Date.now() - this.cache.at < 10_000)
      return this.cache.value;
    const rows = await tx.select().from(appSettings);
    const value = mergeSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
    if (tx === this.db) this.cache = { at: Date.now(), value };
    return value;
  }
  async value(key: string, tx: Executor = this.db) {
    return (await tx.select().from(appSettings).where(eq(appSettings.key, key)))[0]?.value;
  }
  async put(key: string, value: unknown, tx: Executor = this.db) {
    await tx
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    this.cache = undefined;
  }
  async set(part: string, input: unknown) {
    if (part === 'affiliate') {
      const value = z
        .strictObject({
          enabled: z.boolean(),
          percent: z.number().int().min(0).max(50),
          firstOrderOnly: z.literal(true),
        })
        .parse(input);
      await this.put(part, value);
      return value;
    }
    if (!(part in appSettingsSchema.shape)) missing();
    const key = part as keyof AppSettings;
    const value = appSettingsSchema.shape[key].parse(input);
    await this.db.transaction(async (tx) => {
      await this.put(key, value, tx);
      if (key === 'certificate') {
        const v = appSettingsSchema.shape.certificate.parse(value);
        await tx.execute(
          sql`update ${certificates} set child_name = case when ${v.useFullName} and c.certificate_name is not null then c.certificate_name else c.nickname end from ${children} c where c.id = ${certificates.childId}`,
        );
      }
    });
    return this.get();
  }
}
