import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { jwtSecret } from './config.js';
export type Sealed = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
  last4: string;
  updatedAt: string;
};
const key = () => createHash('sha256').update(`udakids-secret-v1|${jwtSecret()}`).digest();
export function seal(plain: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
    last4: plain.slice(-4),
    updatedAt: new Date().toISOString(),
  };
}
export function open(box: Sealed | null): string | null {
  if (!box || box.v !== 1) return null;
  try {
    const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(box.iv, 'base64'));
    cipher.setAuthTag(Buffer.from(box.tag, 'base64'));
    return Buffer.concat([cipher.update(Buffer.from(box.data, 'base64')), cipher.final()]).toString(
      'utf8',
    );
  } catch {
    return null;
  }
}
