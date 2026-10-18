import 'reflect-metadata';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/app-setup.js';
import { DB, PG_POOL } from '../src/db/db.module.js';
import { seed } from '../src/cli/seed.js';
import { MAIL_TRANSPORT } from '../src/mail/mail.service.js';
import * as schema from '../src/db/schema.js';
import { IMAGE_PROVIDER } from '../src/ai/image.provider.js';
import { TTS_PROVIDER, VoiceService } from '../src/voice/voice.service.js';

export async function setup() {
  process.env.ADMIN_PASSWORD = 'tes-admin-aman-123';
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') });
  await seed(db);
  const mails: { to: string; subject: string; html: string; text: string }[] = [];
  const speech: string[] = [];
  const pictures: string[] = [];
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DB)
    .useValue(db)
    .overrideProvider(PG_POOL)
    .useValue({ end: async () => {} })
    .overrideProvider(IMAGE_PROVIDER)
    .useValue({
      generate: async (prompt: string) => {
        pictures.push(prompt);
        return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
      },
    })
    .overrideProvider(TTS_PROVIDER)
    .useValue({
      synthesize: async (text: string) => {
        speech.push(text);
        return Buffer.from('test-mp3');
      },
    })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue({
      sendMail: async (mail: (typeof mails)[number]) => {
        mails.push(mail);
      },
    })
    .compile();
  const app = configureApp(
    module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false }),
  );
  await app.init();
  return {
    app,
    db,
    client,
    mails,
    speech,
    pictures,
    close: async () => {
      await app.get(VoiceService).drain();
      await app.close();
      await client.close();
    },
  };
}
