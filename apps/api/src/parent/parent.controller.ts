import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { setPinBodySchema } from '@udakids/engine';
import { CurrentUser, Roles, type User } from '../auth/decorators.js';
import { ParentService } from './parent.service.js';
@Controller('parent')
@Roles('parent')
export class ParentController {
  constructor(private service: ParentService) {}
  @Get('children') async list(@CurrentUser() u: User) {
    return (await this.service.children(u.id)).map((c) => this.service.learning.profileView(c));
  }
  @Post('children') create(@CurrentUser() u: User, @Body() b: unknown) {
    return this.service.create(u.id, b);
  }
  @Patch('children/:id') update(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.update(u.id, z.uuid().parse(id), b);
  }
  @Delete('children/:id') @HttpCode(204) remove(@CurrentUser() u: User, @Param('id') id: string) {
    return this.service.remove(u.id, z.uuid().parse(id));
  }
  @Put('children/:id/pin') @HttpCode(204) async pin(
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    await this.service.update(u.id, z.uuid().parse(id), setPinBodySchema.parse(b));
  }
  @Get('children/:id/report') async report(@CurrentUser() u: User, @Param('id') id: string) {
    await this.service.owned(u.id, z.uuid().parse(id));
    return this.service.report(id);
  }
  @Get('overview') overview(@CurrentUser() u: User) {
    return this.service.overview(u.id);
  }
  @Get('plan') async plan(@CurrentUser() u: User) {
    return {
      adminWhatsapp: (await this.service.learning.settings.get()).contact.adminWhatsapp,
      children: await Promise.all(
        (await this.service.children(u.id)).map(async (c) => {
          const state = await this.service.learning.state(c.id);
          return {
            id: c.id,
            nickname: c.nickname,
            plan: state.premium ? 'premium' : 'free',
            until: state.until,
          };
        }),
      ),
    };
  }
}
