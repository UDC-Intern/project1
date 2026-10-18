import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { generateRound, stampSchema, STAMP_LIBRARY_MAX } from '@udakids/engine';
import { Roles } from '../auth/decorators.js';
import { ContentService } from './content.service.js';
import { CurriculumService, effective } from './curriculum.service.js';
import { DB, type Db } from '../db/db.module.js';
import { stamps } from '../db/schema.js';
import { fail, missing } from '../common/errors.js';
@Controller('admin')
@Roles('admin')
export class ContentController {
  constructor(
    private content: ContentService,
    private curriculum: CurriculumService,
    @Inject(DB) private db: Db,
  ) {}
  @Get('catalogs') catalogs() {
    return this.content.catalog();
  }
  @Get('catalog') async legacy() {
    return {
      books: (await this.content.catalog()).map((b) => ({
        ...b,
        id: b.slug,
        topics: b.topics.map((t) => ({
          ...t,
          levels: t.levels.map((l) => ({ ...l, isFree: l.free })),
        })),
      })),
    };
  }
  @Post('books') book(@Body() b: unknown) {
    return this.content.addBook(b);
  }
  @Post('books/:slug/topics') topic(@Param('slug') id: string, @Body() b: unknown) {
    return this.content.addTopic(id, b);
  }
  @Post('topics/:id/levels') level(@Param('id') id: string, @Body() b: unknown) {
    return this.content.addLevel(id, b);
  }
  @Patch('topics/:id') updateTopic(@Param('id') id: string, @Body() b: unknown) {
    return this.content.updateTopic(id, b);
  }
  @Patch('levels/:id') updateLevel(@Param('id') id: string, @Body() b: unknown) {
    return this.content.updateLevel(id, b);
  }
  @Delete('books/:slug') removeBook(@Param('slug') id: string) {
    return this.content.remove('book', id);
  }
  @Delete('topics/:id') removeTopic(@Param('id') id: string) {
    return this.content.remove('topic', id);
  }
  @Delete('levels/:id') removeLevel(@Param('id') id: string) {
    return this.content.remove('level', id);
  }
  @Get('levels/:id/questions') questions(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('seed') seed?: string,
  ) {
    return this.content.questions(
      id,
      from,
      seed ? z.coerce.number().int().min(0).max(0xffffffff).parse(seed) : 1,
    );
  }
  @Put('levels/:id/questions') save(@Param('id') id: string, @Body() b: unknown) {
    return this.content.saveQuestions(id, b);
  }
  @Delete('levels/:id/questions') clear(@Param('id') id: string) {
    return this.content.clearQuestions(id);
  }
  @Get('preview') async preview(@Query('levelId') id: string, @Query('seed') seed?: string) {
    const f = await this.curriculum.find(z.string().min(1).parse(id));
    const spec = effective(f.level);
    if (!spec) fail(409, 'NOT_ENOUGH_QUESTIONS', 'Level belum punya soal.');
    const value = seed ? z.coerce.number().int().parse(seed) : 1;
    return {
      levelId: id,
      seed: value,
      questions: generateRound(spec, value).map((q, index) => ({ ...q, index, audioUrl: null })),
    };
  }
  @Get('media/usage') usage() {
    return this.content.usage();
  }
  @Get('stamps') listStamps() {
    return this.db.select().from(stamps).orderBy(stamps.createdAt).limit(STAMP_LIBRARY_MAX);
  }
  @Post('stamps') async addStamp(@Body() b: unknown) {
    const v = stampSchema.omit({ id: true, createdAt: true }).parse(b);
    return this.db.transaction(async (tx) => {
      const rows = await tx.select().from(stamps);
      const same = rows.find((r) => r.image === v.image);
      if (same) return { ...same, createdAt: same.createdAt.toISOString() };
      if (rows.length >= STAMP_LIBRARY_MAX) fail(409, 'CONFLICT', 'Riwayat stempel sudah penuh.');
      const [row] = await tx
        .insert(stamps)
        .values({ id: randomUUID(), ...v })
        .returning();
      return { ...row, createdAt: row!.createdAt.toISOString() };
    });
  }
  @Delete('stamps/:id') async removeStamp(@Param('id') id: string) {
    if (!(await this.db.delete(stamps).where(eq(stamps.id, id)).returning()).length) missing();
    return this.db.select().from(stamps).orderBy(stamps.createdAt).limit(STAMP_LIBRARY_MAX);
  }
}
