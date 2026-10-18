import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { Roles } from '../auth/decorators.js';
import { MailService } from './mail.service.js';
import { DB, type Db } from '../db/db.module.js';
import { emailOutbox } from '../db/schema.js';
import { fail, missing } from '../common/errors.js';
@Controller('admin/mail')
@Roles('admin')
export class MailController {
  constructor(
    private mail: MailService,
    @Inject(DB) private db: Db,
  ) {}
  @Get() overview() {
    return this.mail.overview();
  }
  @Post(':id/retry') async retry(@Param('id') raw: string) {
    const id = z.uuid().parse(raw);
    const [row] = await this.db.select().from(emailOutbox).where(eq(emailOutbox.id, id));
    if (!row) missing();
    if (!row.html && !row.text) fail(409, 'CONFLICT', 'Isi email sudah dihapus setelah terkirim.');
    await this.db
      .update(emailOutbox)
      .set({ status: 'queued', attempts: 0, nextAttemptAt: new Date(), lastError: null })
      .where(eq(emailOutbox.id, id));
    return { ok: true };
  }
}
