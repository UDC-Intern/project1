import { runSeed } from '../src/cli/seed.js';
void runSeed().catch(() => {
  console.error('Seed belum berhasil. Periksa database dan konfigurasi admin.');
  process.exitCode = 1;
});
