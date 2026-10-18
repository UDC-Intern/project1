import { Global, Module } from '@nestjs/common';
import { MailService, MAIL_TRANSPORT } from './mail.service.js';
@Global()
@Module({
  providers: [MailService, { provide: MAIL_TRANSPORT, useValue: null }],
  exports: [MailService],
})
export class MailModule {}
