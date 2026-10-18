import { randomBytes, randomInt, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(secret, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifySecret(
  secret: string,
  encoded: string | null | undefined,
): Promise<boolean> {
  if (!encoded) return false;
  const [kind, salt, hex] = encoded.split('$');
  if (kind !== 'scrypt' || !salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const actual = (await derive(secret, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}

export const randomCode = (length = 6, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ') =>
  Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
export const ipHash = (ip: string) => createHash('sha256').update(ip).digest('hex');
