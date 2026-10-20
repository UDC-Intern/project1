import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { affiliateSettingsSchema, payoutRequestSchema } from '@udakids/engine';
import { CurrentUser, Public, Roles, type User } from '../auth/decorators.js';
import { SettingsService } from '../settings/settings.service.js';
import { AffiliateService } from './affiliate.service.js';

@Controller('referral')
export class ReferralController {
  constructor(private affiliate: AffiliateService) {}
  @Public() @Get(':code') preview(@Param('code') code: string) {
    return this.affiliate.preview(code);
  }
  @Public() @Post(':code/click') click(@Param('code') code: string, @Req() req: Request) {
    return this.affiliate.click(code, req.ip ?? 'unknown');
  }
}

@Controller('parent/affiliate')
@Roles('parent')
export class ParentAffiliateController {
  constructor(private affiliate: AffiliateService) {}
  @Get() overview(@CurrentUser() user: User, @Req() req: Request) {
    const origin =
      process.env.WEB_ORIGIN?.split(',')[0]?.trim() || `${req.protocol}://${req.get('host')}`;
    return this.affiliate.overview(user.id, origin);
  }
  @Get('members') members(@CurrentUser() user: User) {
    return this.affiliate.members(user.id);
  }
  @Get('analytics') analytics(@CurrentUser() user: User) {
    return this.affiliate.analytics(user.id);
  }
  @Get('ledger') ledger(@CurrentUser() user: User) {
    return this.affiliate.ledger(user.id);
  }
  @Get('payouts') payouts(@CurrentUser() user: User) {
    return this.affiliate.payouts(user.id);
  }
  @Post('account/code') code(@CurrentUser() user: User) {
    return this.affiliate.requestAccountCode(user.id);
  }
  @Put('account') account(@CurrentUser() user: User, @Body() body: unknown) {
    return this.affiliate.saveAccount(user.id, body);
  }
  @Post('payouts') payout(@CurrentUser() user: User, @Body() body: unknown) {
    return this.affiliate.requestPayout(user.id, payoutRequestSchema.parse(body).amount);
  }
  @Post('payouts/:id/cancel') cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.affiliate.closePayout(z.uuid().parse(id), 'cancelled', user.id);
  }
}

@Controller('admin/affiliate')
@Roles('admin')
export class AdminAffiliateController {
  constructor(
    private affiliate: AffiliateService,
    private settings: SettingsService,
  ) {}
  @Get() overview() {
    return this.affiliate.adminOverview();
  }
  @Get('analytics') analytics() {
    return this.affiliate.adminAnalytics();
  }
  @Get('settings') settingsValue() {
    return this.affiliate.rules();
  }
  @Put('settings') updateSettings(@Body() body: unknown) {
    return this.settings.set('affiliate', affiliateSettingsSchema.parse(body));
  }
  @Get('affiliates') affiliates() {
    return this.affiliate.adminAffiliates();
  }
  @Get('affiliates/:id') affiliateDetail(@Param('id') id: string) {
    return this.affiliate.adminAffiliate(z.uuid().parse(id));
  }
  @Post('affiliates/:id/adjust') adjust(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = z
      .object({
        amount: z.number().int().min(-10_000_000).max(10_000_000),
        note: z.string().trim().min(3).max(200),
      })
      .parse(body);
    return this.affiliate.adjust(z.uuid().parse(id), data.amount, data.note, user.id);
  }
  @Post('ledger/:id/void') voidEntry(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { note } = z.object({ note: z.string().trim().min(3).max(200) }).parse(body);
    return this.affiliate.voidEntry(z.uuid().parse(id), note, user.id);
  }
  @Get('payouts') payouts() {
    return this.affiliate.adminPayouts();
  }
  @Get('payouts/:id/account') payoutAccount(@Param('id') id: string) {
    return this.affiliate.payoutAccount(z.uuid().parse(id));
  }
  @Post('payouts/:id/paid') paid(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { transferRef } = z
      .object({ transferRef: z.string().trim().max(80).default('') })
      .parse(body);
    return this.affiliate.closePayout(z.uuid().parse(id), 'paid', user.id, transferRef);
  }
  @Post('payouts/:id/reject') reject(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(200) }).parse(body);
    return this.affiliate.closePayout(z.uuid().parse(id), 'rejected', user.id, reason);
  }
  @Get('accounts') accounts() {
    return this.affiliate.adminAccounts();
  }
  @Post('accounts/:id/review') review(@Param('id') id: string, @Body() body: unknown) {
    const { approved, note } = z
      .object({ approved: z.boolean(), note: z.string().trim().max(200).default('') })
      .parse(body);
    return this.affiliate.reviewAccount(z.uuid().parse(id), approved, note);
  }
}
