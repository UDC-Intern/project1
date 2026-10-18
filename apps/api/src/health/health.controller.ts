import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private db: Db) {}
  @Public() @Get() async health() {
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, status: 'ok', db: true };
    } catch {
      return { ok: true, status: 'ok', db: false };
    }
  }
}
