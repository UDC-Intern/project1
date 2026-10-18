import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser, Roles, type User } from '../auth/decorators.js';
import { AccountService } from './account.service.js';
@Controller('parent')
@Roles('parent')
export class AccountController {
  constructor(private service: AccountService) {}
  @Get('account') get(@CurrentUser() u: User) {
    return this.service.get(u.id);
  }
  @Patch('account') name(@CurrentUser() u: User, @Body() b: unknown) {
    return this.service.name(u.id, b);
  }
  @Put('account/password') password(@CurrentUser() u: User, @Body() b: unknown) {
    return this.service.password(u.id, b);
  }
  @Put('password') oldPassword(@CurrentUser() u: User, @Body() b: unknown) {
    return this.service.password(u.id, b, true);
  }
  @Post(['account/email', 'email/request']) email(@CurrentUser() u: User, @Body() b: unknown) {
    return this.service.requestEmail(u.id, b);
  }
  @Post(['account/email/verify', 'email/confirm']) confirm(
    @CurrentUser() u: User,
    @Body() b: unknown,
  ) {
    return this.service.confirmEmail(u.id, b);
  }
}
