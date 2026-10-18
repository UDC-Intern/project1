import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { SettingsService } from './settings.service.js';
@Controller()
export class SettingsController {
  constructor(private settings: SettingsService) {}
  @Public() @Get('settings') get() {
    return this.settings.get();
  }
  @Roles('admin') @Get('admin/settings') admin() {
    return this.settings.get();
  }
  @Roles('admin') @Put('admin/settings/:part') set(
    @Param('part') part: string,
    @Body() body: unknown,
  ) {
    return this.settings.set(part, body);
  }
}
