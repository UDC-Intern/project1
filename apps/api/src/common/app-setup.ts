import type { Request, Response, NextFunction } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PROOF_MAX_BYTES } from '@udakids/engine';
import { AllExceptionsFilter } from './errors.js';

const proof = /^\/parent\/orders\/[^/]+\/proof$/;
const big =
  /^\/(?:admin\/(?:levels\/[^/]+\/questions|settings\/certificate|stamps)|billing\/orders\/[^/]+\/proof)$/;
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
    const binary = req.is('image/*') || req.is('application/octet-stream');
    const allowed =
      (req.method === 'PUT' && proof.test(req.path)) ||
      (req.method === 'POST' && req.path === '/admin/media');
    if (binary && !allowed)
      return res.status(415).json({
        error: { code: 'VALIDATION', message: 'Jenis isi tidak diterima di alamat ini.' },
        message: 'Jenis isi tidak diterima di alamat ini.',
        statusCode: 415,
      });
    next();
  });
  app.useBodyParser('raw', {
    type: (req) =>
      !!req.url && (proof.test(req.url.split('?')[0]!) || req.url.split('?')[0] === '/admin/media'),
    limit: PROOF_MAX_BYTES,
  });
  app.useBodyParser('json', {
    type: (req) => !!req.url && big.test(req.url.split('?')[0]!),
    limit: '5mb',
  });
  app.useBodyParser('json', { limit: '100kb' });
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}
