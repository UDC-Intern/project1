import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentUser, Public, Roles, type User } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';
import { mediaFiles, voiceClips } from '../db/schema.js';
import { validateImage } from './image.js';
import { missing } from '../common/errors.js';
@Controller()
export class MediaController {
  constructor(@Inject(DB) private db: Db) {}
  @Roles('admin') @Post('admin/media') async upload(
    @CurrentUser() u: User,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const image = validateImage(body, req.headers['content-type']);
    const name = z.string().max(100).default('gambar').parse(req.headers['x-file-name']);
    const [row] = await this.db
      .insert(mediaFiles)
      .values({
        ...image,
        name: name.replace(/[^\w. -]/g, ''),
        bytes: image.data.length,
        createdBy: u.id,
      })
      .returning({
        id: mediaFiles.id,
        name: mediaFiles.name,
        mime: mediaFiles.mime,
        bytes: mediaFiles.bytes,
      });
    return { ...row, url: `/api/media/${row!.id}` };
  }
  @Roles('admin') @Get('admin/media') list() {
    return this.db
      .select({
        id: mediaFiles.id,
        name: mediaFiles.name,
        mime: mediaFiles.mime,
        bytes: mediaFiles.bytes,
        createdAt: mediaFiles.createdAt,
      })
      .from(mediaFiles)
      .orderBy(desc(mediaFiles.createdAt))
      .limit(100);
  }
  @Public() @Get('media/:id') async media(@Param('id') raw: string, @Res() res: Response) {
    const [row] = await this.db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, z.uuid().parse(raw)));
    if (!row) missing();
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type(row.mime).send(row.data);
  }
  @Public() @Get('voice/:hash') async voice(@Param('hash') raw: string, @Res() res: Response) {
    const hash = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(raw);
    const [clip] = await this.db.select().from(voiceClips).where(eq(voiceClips.hash, hash));
    if (!clip) missing();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${hash}"`);
    res.type(clip.mime).send(clip.data);
  }
}
