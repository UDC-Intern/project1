import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';

export type GoogleProfile = { sub: string; email: string; name: string };
type Jwk = JsonWebKey & { kid?: string };
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const SKEW_SECONDS = 60;

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID?.trim() || '';

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

@Injectable()
export class GoogleVerifier {
  private keys = new Map<string, Jwk>();
  private keysUntil = 0;

  private async key(kid: string) {
    if (Date.now() > this.keysUntil || !this.keys.has(kid)) {
      const response = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Google keys HTTP ${response.status}`);
      const body = (await response.json()) as { keys: Jwk[] };
      this.keys = new Map(body.keys.map((key) => [key.kid ?? '', key]));
      const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1]);
      this.keysUntil = Date.now() + (Number.isFinite(maxAge) ? maxAge : 3600) * 1000;
    }
    return this.keys.get(kid);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    const clientId = googleClientId();
    const bad = (reason: string): never => {
      throw new UnauthorizedException(`Masuk dengan Google gagal (${reason}). Coba lagi.`);
    };
    if (!clientId) bad('belum diatur');
    const parts = idToken.split('.');
    if (parts.length !== 3) bad('token tidak valid');
    const [headerPart, claimsPart, signaturePart] = parts as [string, string, string];
    let header!: Record<string, unknown>;
    let claims!: Record<string, unknown>;
    try {
      header = decode(headerPart);
      claims = decode(claimsPart);
    } catch {
      return bad('token tidak valid');
    }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') bad('token tidak valid');
    const jwk = await this.key(header.kid as string).catch(() => undefined);
    if (!jwk) bad('kunci tidak dikenal');
    if (
      !verifySignature(
        'RSA-SHA256',
        Buffer.from(`${headerPart}.${claimsPart}`),
        createPublicKey({ key: jwk!, format: 'jwk' }),
        Buffer.from(signaturePart, 'base64url'),
      )
    )
      bad('tanda tangan tidak cocok');
    const now = Math.floor(Date.now() / 1000);
    if (!ISSUERS.has(String(claims.iss))) bad('penerbit tidak dikenal');
    const audience = claims.aud;
    if (!(audience === clientId || (Array.isArray(audience) && audience.includes(clientId))))
      bad('aplikasi lain');
    if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS < now) bad('kedaluwarsa');
    if (typeof claims.iat === 'number' && claims.iat - SKEW_SECONDS > now) bad('waktu tidak valid');
    if (claims.email_verified !== true && claims.email_verified !== 'true')
      bad('email Google belum terverifikasi');
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    const sub = typeof claims.sub === 'string' ? claims.sub : '';
    if (!email || !sub) bad('data akun tidak lengkap');
    const name = (typeof claims.name === 'string' ? claims.name : '').trim().slice(0, 60);
    return { sub, email, name: name || email.split('@')[0]!.slice(0, 60) };
  }
}
