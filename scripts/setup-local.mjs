import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const env = new URL('.env', root);
if (existsSync(env)) {
  console.log('.env sudah ada dan tetap dipakai.');
} else {
  let text = readFileSync(new URL('.env.example', root), 'utf8');
  const values = {
    DATABASE_DRIVER: 'pglite',
    JWT_SECRET: randomBytes(48).toString('base64url'),
    ADMIN_PASSWORD: randomBytes(18).toString('base64url'),
    VITE_MOCK_MODULES: '',
    MAIL_WORKER: 'off',
  };
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    text = pattern.test(text)
      ? text.replace(pattern, `${key}=${value}`)
      : `${text}\n${key}=${value}\n`;
  }
  writeFileSync(env, text, { flag: 'wx', mode: 0o600 });
  console.log(`Konfigurasi lokal dibuat: ${fileURLToPath(env)}`);
  console.log(
    'Kata sandi admin ada di ADMIN_PASSWORD dalam .env. Data lokal tersimpan di .data/development.',
  );
}
