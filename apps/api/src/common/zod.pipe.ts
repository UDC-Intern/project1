import { type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
export class ZodPipe<T> implements PipeTransform {
  constructor(private schema: ZodType<T>) {}
  transform(input: unknown): T {
    return this.schema.parse(input);
  }
}
