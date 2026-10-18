import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  answerBodySchema,
  setMomoBodySchema,
  startRoundBodySchema,
  subjectDomainOf,
} from '@udakids/engine';
import { CurrentUser, Roles, type User } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';
import { children } from '../db/schema.js';
import { LearningService } from './learning.service.js';
import { PracticeService } from '../practice/practice.service.js';
@Controller()
@Roles('child')
export class CatalogController {
  constructor(
    private learning: LearningService,
    private practice: PracticeService,
    @Inject(DB) private db: Db,
  ) {}
  @Roles('parent') @Get('catalog') async catalogs() {
    return {
      catalogs: (await this.learning.curriculum.books()).map((b) => ({
        domain: subjectDomainOf(b.subject),
        grade: `sd${b.grade}`,
        title: b.title,
      })),
    };
  }
  @Get('catalog/home') home(@CurrentUser() u: User) {
    return this.learning.home(u.id);
  }
  @Get('catalog/books/:slug') book(@CurrentUser() u: User, @Param('slug') slug: string) {
    return this.learning.book(u.id, slug);
  }
  @Get('catalog/topics/:id') topic(@CurrentUser() u: User, @Param('id') id: string) {
    return this.learning.topic(u.id, id);
  }
  @Get('child/profile') profile(@CurrentUser() u: User) {
    return this.learning.profile(u.id);
  }
  @Put('child/momo') async momo(@CurrentUser() u: User, @Body() body: unknown) {
    const value = setMomoBodySchema.parse(body);
    await this.db.update(children).set(value).where(eq(children.id, u.id));
    return value;
  }
  @Post('practice/rounds') start(@CurrentUser() u: User, @Body() body: unknown) {
    return this.practice.start(u.id, startRoundBodySchema.parse(body).levelId);
  }
  @Post('practice/rounds/:id/answers') answer(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.practice.answer(u.id, z.uuid().parse(id), answerBodySchema.parse(body));
  }
  @Post('practice/rounds/:id/finish') finish(@CurrentUser() u: User, @Param('id') id: string) {
    return this.practice.finish(u.id, z.uuid().parse(id));
  }
  @Get('practice/rounds/:id') result(@CurrentUser() u: User, @Param('id') id: string) {
    return this.learning.roundResult(z.uuid().parse(id), u.id);
  }
}
