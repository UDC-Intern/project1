import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { DEFAULT_DATABASE_URL } from '../src/common/config.js';
import { runPg } from './pg-tools.js';
async function main() {
  const argument = process.argv.slice(2).find((v) => v !== '--');
  if (!argument) throw new Error('Sebutkan berkas cadangan.');
  const file = resolve(argument);
  await access(file);
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      'Pemulihan mengganti isi database tujuan. Ketik ya untuk melanjutkan: ',
    );
    if (answer.trim() !== 'ya') return;
    await runPg('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--dbname',
      process.env.PGDATABASE ??
        new URL(process.env.DATABASE_URL || DEFAULT_DATABASE_URL).pathname.slice(1),
      file,
    ]);
  } finally {
    rl.close();
  }
}
void main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
