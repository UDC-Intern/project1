import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';
import type { Response } from 'express';
import type { ApiErrorBody } from '@udakids/engine';

export function fail(
  status: number,
  code: ApiErrorBody['error']['code'],
  message: string,
  extra: Record<string, unknown> = {},
): never {
  throw new HttpException(
    { error: { code, message, ...extra }, message, statusCode: status },
    status,
  );
}

export function missing(): never {
  return fail(404, 'NOT_FOUND', 'Data tidak ketemu.');
}

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION', message: 'Periksa kembali isian.' },
        message: 'Periksa kembali isian.',
        statusCode: 400,
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      if (typeof body === 'object' && 'error' in body) return res.status(status).json(body);
      const code =
        status === 401
          ? 'UNAUTHENTICATED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 429
                ? 'RATE_LIMITED'
                : 'VALIDATION';
      const message = typeof body === 'string' ? body : error.message;
      return res.status(status).json({ error: { code, message }, message, statusCode: status });
    }
    const cause = error as {
      code?: string;
      cause?: { code?: string };
      type?: string;
      status?: number;
    };
    const code = cause.code ?? cause.cause?.code;
    const conflict = code === '23505';
    const unavailable = ['ECONNREFUSED', '57P01', '57014', 'ETIMEDOUT'].includes(code ?? '');
    const status = conflict ? 409 : unavailable ? 503 : cause.status === 413 ? 413 : 500;
    const message = conflict
      ? 'Data sudah digunakan.'
      : status === 413
        ? 'Ukuran berkas terlalu besar.'
        : 'Layanan belum tersedia. Coba lagi nanti.';
    if (status === 500)
      console.error(
        'Permintaan API tidak berhasil:',
        error instanceof Error ? error.name : 'UnknownError',
      );
    return res.status(status).json({
      error: { code: conflict ? 'CONFLICT' : 'VALIDATION', message },
      message,
      statusCode: status,
    });
  }
}
