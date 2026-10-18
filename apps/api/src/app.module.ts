import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { SettingsService } from './settings/settings.service.js';
import { SettingsController } from './settings/settings.controller.js';
import { CurriculumService } from './content/curriculum.service.js';
import { LearningService } from './catalog/learning.service.js';
import { PracticeService } from './practice/practice.service.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { ParentController } from './parent/parent.controller.js';
import { ParentService } from './parent/parent.service.js';
import { AccountService } from './parent/account.service.js';
import { AccountController } from './parent/account.controller.js';
import { BillingController } from './billing/billing.controller.js';
import { BillingService } from './billing/billing.service.js';
import { CertificatesController } from './certificates/certificates.controller.js';
import { ContentService } from './content/content.service.js';
import { ContentController } from './content/content.controller.js';
import { DirectoryService } from './admin/directory.service.js';
import { UsersController } from './admin/users.controller.js';
import { ReportsService } from './reports/reports.service.js';
import { ReportsController } from './reports/reports.controller.js';
import { LeaderboardController } from './leaderboard/leaderboard.controller.js';
import { VoiceService, TTS_PROVIDER, ttsFromEnv } from './voice/voice.service.js';
import { MediaController } from './media/media.controller.js';
import { AiController } from './ai/ai.controller.js';
import { IMAGE_PROVIDER, imageFromEnv } from './ai/image.provider.js';
import { FinanceController } from './billing/finance.controller.js';
import { MailController } from './mail/mail.controller.js';
@Module({
  imports: [DbModule, AuthModule],
  controllers: [
    HealthController,
    SettingsController,
    CatalogController,
    ParentController,
    AccountController,
    BillingController,
    CertificatesController,
    ContentController,
    UsersController,
    ReportsController,
    LeaderboardController,
    MediaController,
    AiController,
    FinanceController,
    MailController,
  ],
  providers: [
    SettingsService,
    CurriculumService,
    LearningService,
    PracticeService,
    ParentService,
    AccountService,
    BillingService,
    ContentService,
    DirectoryService,
    ReportsService,
    VoiceService,
    { provide: TTS_PROVIDER, useFactory: ttsFromEnv },
    { provide: IMAGE_PROVIDER, useFactory: imageFromEnv },
  ],
})
export class AppModule {}
