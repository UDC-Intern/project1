import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { and, desc, eq, gte, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { illustrationRequestSchema, ILLUSTRATION_STATUSES } from '@udakids/engine';
import { CurrentUser, Public, Roles, type User } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';
import { illustrations, levels } from '../db/schema.js';
import { IMAGE_PROVIDER, type ImageProvider } from './image.provider.js';
import { fail, missing } from '../common/errors.js';
import { jakartaDate, iso } from '../common/dates.js';
import { sniffImage } from '../media/image.js';
const fields = {
  id: illustrations.id,
  kind: illustrations.kind,
  subject: illustrations.subject,
  theme: illustrations.theme,
  count: illustrations.count,
  withMomo: illustrations.withMomo,
  momoColor: illustrations.momoColor,
  variant: illustrations.variant,
  status: illustrations.status,
  engine: illustrations.engine,
  createdBy: illustrations.createdBy,
  createdAt: illustrations.createdAt,
  reviewedAt: illustrations.reviewedAt,
  hasImage: sql<boolean>`${illustrations.imageData} is not null`,
};
const view = (row: {
  id: string;
  status: string;
  hasImage: boolean;
  createdAt: Date;
  reviewedAt: Date | null;
}) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  reviewedAt: iso(row.reviewedAt),
  imageUrl: row.hasImage
    ? row.status === 'approved'
      ? `/api/illustrations/${row.id}/image`
      : `/api/admin/illustrations/${row.id}/image`
    : null,
});
@Controller()
export class AiController {
  private busy = false;
  constructor(
    @Inject(DB) private db: Db,
    @Inject(IMAGE_PROVIDER) private provider: ImageProvider | null,
  ) {}
  @Roles('admin') @Get('admin/illustrations') async list(@Query('status') raw?: string) {
    const status = z
      .enum([...ILLUSTRATION_STATUSES, 'all'])
      .default('all')
      .parse(raw);
    const rows = await this.db
      .select(fields)
      .from(illustrations)
      .where(status === 'all' ? undefined : eq(illustrations.status, status))
      .orderBy(desc(illustrations.createdAt))
      .limit(500);
    return rows.map(view);
  }
  @Roles('admin') @Post('admin/illustrations') async create(
    @CurrentUser() u: User,
    @Body() input: unknown,
  ) {
    const body = illustrationRequestSchema.parse(input);
    if (this.busy) fail(429, 'RATE_LIMITED', 'Pembuatan gambar masih berjalan.');
    this.busy = true;
    try {
      const [count] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(illustrations)
        .where(
          and(
            gte(illustrations.createdAt, new Date(`${jakartaDate()}T00:00:00+07:00`)),
            ilike(illustrations.engine, 'openai%'),
          ),
        );
      if (this.provider && count!.n >= Number(process.env.AI_DAILY_LIMIT ?? 30))
        fail(429, 'RATE_LIMITED', 'Batas gambar harian sudah tercapai.');
      const prompt = `Create a friendly flat educational illustration for primary school children. Exactly ${body.count} objects. Subject (description only): ${JSON.stringify(body.subject)}. Scene: ${body.theme}. Variant: ${body.variant}. ${body.withMomo ? `Include Momo, a rounded square robot with an antenna, color ${body.momoColor}.` : ''} No text, no brands, no frightening content. All objects clearly countable.`;
      const [made] = await this.db
        .insert(illustrations)
        .values({
          ...body,
          createdBy: u.name,
          engine: this.provider
            ? `openai ${process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1'}`
            : 'Pustaka bentuk UdaKids (tanpa penyedia)',
          prompt,
        })
        .returning({ id: illustrations.id });
      if (this.provider) {
        try {
          const data = await this.provider.generate(prompt);
          const mime = sniffImage(data);
          if (!mime || data.length > 3 * 1024 * 1024) throw new Error('Gambar tidak didukung.');
          await this.db
            .update(illustrations)
            .set({ imageData: data, imageMime: mime })
            .where(eq(illustrations.id, made!.id));
        } catch {
          await this.db
            .update(illustrations)
            .set({ engine: 'openai: pembuatan belum berhasil' })
            .where(eq(illustrations.id, made!.id));
          fail(503, 'RATE_LIMITED', 'Gambar belum bisa dibuat. Coba lagi nanti.');
        }
      }
      return view(
        (
          await this.db.select(fields).from(illustrations).where(eq(illustrations.id, made!.id))
        )[0]!,
      );
    } finally {
      this.busy = false;
    }
  }
  @Roles('admin') @Patch('admin/illustrations/:id') async review(
    @Param('id') raw: string,
    @Body() b: unknown,
  ) {
    const id = z.uuid().parse(raw);
    const v = z.object({ status: z.enum(ILLUSTRATION_STATUSES) }).parse(b);
    const rows = await this.db
      .update(illustrations)
      .set({ ...v, reviewedAt: v.status === 'review' ? null : new Date() })
      .where(eq(illustrations.id, id))
      .returning({ id: illustrations.id });
    if (!rows.length) missing();
    return view(
      (await this.db.select(fields).from(illustrations).where(eq(illustrations.id, id)))[0]!,
    );
  }
  @Roles('admin') @Delete('admin/illustrations/:id') async remove(@Param('id') raw: string) {
    const id = z.uuid().parse(raw);
    const used = await this.db
      .select({ id: levels.id })
      .from(levels)
      .where(sql`${levels.bank}::text like ${`%/illustrations/${id}/image%`}`)
      .limit(1);
    if (used.length) fail(409, 'CONFLICT', 'Ilustrasi masih dipakai pada soal.');
    if (!(await this.db.delete(illustrations).where(eq(illustrations.id, id)).returning()).length)
      missing();
  }
  private async image(id: string, res: Response, publicOnly: boolean) {
    const [row] = await this.db
      .select()
      .from(illustrations)
      .where(
        and(
          eq(illustrations.id, z.uuid().parse(id)),
          publicOnly ? eq(illustrations.status, 'approved') : undefined,
        ),
      );
    if (!row?.imageData || !row.imageMime) missing();
    res.setHeader('Cache-Control', publicOnly ? 'public, max-age=300' : 'private, no-store');
    res.type(row.imageMime).send(row.imageData);
  }
  @Roles('admin') @Get('admin/illustrations/:id/image') adminImage(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.image(id, res, false);
  }
  @Public() @Get('illustrations/:id/image') publicImage(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.image(id, res, true);
  }
}
