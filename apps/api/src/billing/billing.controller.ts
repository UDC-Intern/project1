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
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatusSchema } from '@udakids/engine';
import { CurrentUser, Public, Roles, type User } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';
import * as s from '../db/schema.js';
import { BillingService, orderDto } from './billing.service.js';
import { missing } from '../common/errors.js';
@Controller()
@Roles('parent')
export class BillingController {
  constructor(
    private service: BillingService,
    @Inject(DB) private db: Db,
  ) {}
  @Public() @Get('packages') publicPackages() {
    return this.service.packages();
  }
  @Get('billing/packages') packages() {
    return this.service.packages();
  }
  @Get('billing/methods') methods() {
    return this.service.methods();
  }
  @Get('parent/billing') overview(@CurrentUser() u: User) {
    return this.service.overview(u.id);
  }
  @Get(['parent/orders', 'billing/orders']) list(@CurrentUser() u: User) {
    return this.service.list(u.id);
  }
  @Post(['parent/orders', 'billing/orders']) create(@CurrentUser() u: User, @Body() b: unknown) {
    return this.service.create(u.id, b);
  }
  @Get(['parent/orders/:id', 'billing/orders/:id']) async order(
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    return orderDto(await this.service.row(z.uuid().parse(id), u.id));
  }
  @Post(['parent/orders/:id/cancel', 'billing/orders/:id/cancel']) cancel(
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    return this.service.cancel(u.id, z.uuid().parse(id));
  }
  @Put('parent/orders/:id/proof') proof(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: Request,
  ) {
    return this.service.upload(u.id, z.uuid().parse(id), b, req.headers['content-type']);
  }
  @Post('billing/orders/:id/proof') jsonProof(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.upload(u.id, z.uuid().parse(id), b, undefined, true);
  }
  @Get('parent/orders/:id/proof') async readProof(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const row = await this.service.row(z.uuid().parse(id), u.id);
    if (!row.proofData || !row.proofMime) missing();
    res.setHeader('Cache-Control', 'private, no-store');
    res.type(row.proofMime).send(row.proofData);
  }
  @Roles('admin') @Get('admin/orders/pending-count') async pending() {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.orders)
      .where(eq(s.orders.status, 'awaiting_review'));
    return { count: r!.count };
  }
  @Roles('admin') @Get('admin/orders') adminOrders(@Query('status') status?: string) {
    return this.service.list(undefined, status ? orderStatusSchema.parse(status) : undefined);
  }
  @Roles('admin') @Get('admin/orders/:id/proof') async adminProof(@Param('id') id: string) {
    const row = await this.service.row(z.uuid().parse(id));
    if (!row.proofData || !row.proofMime) missing();
    return { dataUrl: `data:${row.proofMime};base64,${row.proofData.toString('base64')}` };
  }
  @Roles('admin') @Post('admin/orders/:id/approve') approve(
    @CurrentUser() u: User,
    @Param('id') id: string,
  ) {
    return this.service.review(z.uuid().parse(id), u.id, true);
  }
  @Roles('admin') @Post('admin/orders/:id/reject') reject(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    const v = z
      .object({
        reason: z.string().trim().min(1).max(200).optional(),
        note: z.string().trim().min(1).max(200).optional(),
      })
      .refine((v) => !!v.reason || !!v.note)
      .parse(b);
    return this.service.review(z.uuid().parse(id), u.id, false, v.reason ?? v.note!);
  }
  @Roles('admin') @Get('admin/packages') adminPackages() {
    return this.service.packages(true);
  }
  @Roles('admin') @Post('admin/packages') createPackage(@Body() b: unknown) {
    return this.service.savePackage(null, b);
  }
  @Roles('admin') @Put('admin/packages/:id') updatePackage(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.savePackage(id, b);
  }
  @Roles('admin') @Patch('admin/packages/:id') patchPackage(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.savePackage(id, b);
  }
  @Roles('admin') @Delete('admin/packages/:id') deletePackage(@Param('id') id: string) {
    return this.service.deletePackage(id);
  }
  @Roles('admin') @Get('admin/payment-methods') adminMethods() {
    return this.service.methods(true);
  }
  @Roles('admin') @Post('admin/payment-methods') createMethod(@Body() b: unknown) {
    return this.service.saveMethod(null, b);
  }
  @Roles('admin') @Put('admin/payment-methods/:id') updateMethod(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.saveMethod(id, b);
  }
  @Roles('admin') @Patch('admin/payment-methods/:id') patchMethod(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.saveMethod(id, b);
  }
  @Roles('admin') @Delete('admin/payment-methods/:id') async deleteMethod(@Param('id') id: string) {
    if (
      !(await this.db.delete(s.paymentMethods).where(eq(s.paymentMethods.id, id)).returning())
        .length
    )
      missing();
  }
  @Get('parent/referral') async referral(@CurrentUser() u: User) {
    const [p] = await this.db.select().from(s.parents).where(eq(s.parents.id, u.id));
    const [r] = await this.db
      .select({
        registered: sql<number>`count(*)::int`,
        paid: sql<number>`count(*) filter(where ${s.referrals.status}='paid')::int`,
      })
      .from(s.referrals)
      .where(eq(s.referrals.referrerId, u.id));
    return { code: p!.familyCode, ...r };
  }
}
