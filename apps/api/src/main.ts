import './common/env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { AppModule } from './app.module.js';
import { configureApp } from './common/app-setup.js';
import { runtimeOptions } from './common/config.js';
async function bootstrap() {
  const options = runtimeOptions();
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false }),
  );
  app.enableCors({ origin: options.origins });
  app.enableShutdownHooks();
  await app.listen(options.port, process.env.API_HOST ?? '127.0.0.1');
  const server = app.getHttpServer() as Server;
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => server.closeAllConnections());
}
void bootstrap().catch(() => {
  console.error('API belum bisa dijalankan. Periksa konfigurasi server.');
  process.exitCode = 1;
});
