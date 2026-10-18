import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { jwtSecret } from '../common/config.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { MailModule } from '../mail/mail.module.js';
import { VerificationService } from './verification.service.js';
@Global()
@Module({
  imports: [MailModule, JwtModule.registerAsync({ useFactory: () => ({ secret: jwtSecret() }) })],
  controllers: [AuthController],
  providers: [
    AuthService,
    VerificationService,
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
  exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
