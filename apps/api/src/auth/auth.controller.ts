import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import {
  childLoginBodySchema,
  loginBodySchema,
  registerParentBodySchema,
  emailSchema,
} from '@udakids/engine';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public, type User } from './decorators.js';
import { parse, fail } from '../common/errors.js';
import { googleClientId } from './google.js';
@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @Public() @Post('parent/register') register(@Body() body: unknown, @Req() req: Request) {
    return this.service.register(parse(registerParentBodySchema, body), req.ip ?? 'unknown');
  }
  @Public() @Post('parent/login') parent(@Body() body: unknown, @Req() req: Request) {
    return this.service.login(parse(loginBodySchema, body), 'parent', req.ip ?? 'unknown');
  }
  @Public() @Get('parent/google') googleConfig() {
    return { clientId: googleClientId() || null };
  }
  @Public() @Post('parent/google') google(@Body() body: unknown, @Req() req: Request) {
    const input = z
      .object({
        credential: z.string().min(20),
        consent: z.boolean().optional(),
        name: z.string().max(60).optional(),
        referralCode: z
          .string()
          .regex(/^[A-Za-z2-9]{6}$/)
          .optional(),
      })
      .parse(body);
    return this.service.parentGoogle(input, req.ip ?? 'unknown');
  }
  @Public() @Post('staff/login') staff(@Body() body: unknown, @Req() req: Request) {
    return this.service.login(parse(loginBodySchema, body), 'staff', req.ip ?? 'unknown');
  }
  @Public() @Get('family/:code') family(@Param('code') code: string, @Req() req: Request) {
    return this.service.family(
      z
        .string()
        .regex(/^[A-Za-z]{6}$/)
        .parse(code),
      req.ip ?? 'unknown',
    );
  }
  @Public() @Post('child/login') child(@Body() body: unknown, @Req() req: Request) {
    return this.service.childLogin(
      childLoginBodySchema.extend({ childId: z.uuid() }).parse(body),
      req.ip ?? 'unknown',
    );
  }
  @Public() @Post('parent/resend') resend(@Body() body: unknown, @Req() req: Request) {
    return this.service.verification.resend(
      z.object({ email: emailSchema }).parse(body).email,
      req.ip ?? 'unknown',
    );
  }
  @Public() @Post('parent/verify') async verify(@Body() body: unknown, @Req() req: Request) {
    const v = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) }).parse(body);
    const parent = await this.service.verification.consume(v.email, v.code, req.ip ?? 'unknown');
    if (!parent) fail(400, 'VALIDATION', 'Kode belum tepat atau sudah kedaluwarsa.');
    return this.service.session(parent, 'parent');
  }
  @Get('me') me(@CurrentUser() user: User) {
    return user;
  }
}
