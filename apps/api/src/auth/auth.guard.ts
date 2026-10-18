import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Db } from '../db/db.module.js';
import { children, parents, staffUsers } from '../db/schema.js';
import { fail } from '../common/errors.js';
import type { User } from './decorators.js';

const payloadSchema = z.object({
  sub: z.uuid(),
  role: z.enum(['admin', 'parent', 'child']),
  v: z.number().default(0),
});
type Account = User & { version: number };

@Injectable()
export class AuthGuard implements CanActivate {
  private accounts = new Map<string, { at: number; account: Account | null }>();
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
    @Inject(DB) private db: Db,
  ) {}
  forget(id: string) {
    for (const key of this.accounts.keys()) if (key.endsWith(`:${id}`)) this.accounts.delete(key);
  }
  private async account(id: string, role: User['role']): Promise<Account | null> {
    const key = `${role}:${id}`;
    const hit = this.accounts.get(key);
    if (hit && Date.now() - hit.at < 10_000) return hit.account;
    let account: Account | null = null;
    if (role === 'child') {
      const [row] = await this.db
        .select({ id: children.id, name: children.nickname, pinChangedAt: children.pinChangedAt })
        .from(children)
        .innerJoin(parents, eq(parents.id, children.parentId))
        .where(and(eq(children.id, id), eq(children.active, true), eq(parents.active, true)));
      if (row) account = { ...row, role, version: row.pinChangedAt?.getTime() ?? 0 };
    } else if (role === 'parent') {
      const [row] = await this.db
        .select()
        .from(parents)
        .where(and(eq(parents.id, id), eq(parents.active, true)));
      if (row && (process.env.EMAIL_VERIFICATION !== 'on' || row.emailVerifiedAt))
        account = { id, name: row.name, role, version: row.passwordChangedAt?.getTime() ?? 0 };
    } else {
      const [row] = await this.db
        .select()
        .from(staffUsers)
        .where(
          and(eq(staffUsers.id, id), eq(staffUsers.active, true), eq(staffUsers.role, 'admin')),
        );
      if (row)
        account = {
          id,
          name: row.name,
          role: 'admin',
          version: row.passwordChangedAt?.getTime() ?? 0,
        };
    }
    if (this.accounts.size >= 5000) this.accounts.delete(this.accounts.keys().next().value!);
    this.accounts.set(key, { at: Date.now(), account });
    return account;
  }
  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) return true;
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; user: User }>();
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) fail(401, 'UNAUTHENTICATED', 'Silakan masuk dulu.');
    let payload: z.infer<typeof payloadSchema>;
    try {
      payload = payloadSchema.parse(await this.jwt.verifyAsync(token));
    } catch {
      fail(401, 'UNAUTHENTICATED', 'Sesi berakhir. Silakan masuk lagi.');
    }
    const account = await this.account(payload.sub, payload.role);
    if (!account || account.version !== payload.v)
      fail(401, 'UNAUTHENTICATED', 'Sesi berakhir. Silakan masuk lagi.');
    req.user = { id: account.id, role: account.role, name: account.name };
    const roles = this.reflector.getAllAndOverride<User['role'][] | undefined>('roles', targets);
    if (roles && !roles.includes(account.role)) fail(403, 'FORBIDDEN', 'Tidak punya akses.');
    return true;
  }
}
