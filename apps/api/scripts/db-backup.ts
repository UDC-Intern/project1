import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { contentDir } from '../src/common/config.js';
import { runPg } from './pg-tools.js';
async function main() {
  const file = resolve(
    process.argv.slice(2).find((v) => v !== '--') ??
      resolve(
        contentDir(),
        '../backups',
        `udakids-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`,
      ),
  );
  await mkdir(dirname(file), { recursive: true });
  await runPg('pg_dump', ['-Fc', '--file', file]);
  console.log(`Cadangan tersimpan: ${file}`);
}
void main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
