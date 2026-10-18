import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC memancarkan metadata dekorator yang dibutuhkan injeksi dependensi NestJS (esbuild tidak).
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Test e2e memanggil login dan daftar berkali-kali dari satu IP: batas per IP dilonggarkan.
    // Verifikasi email dan pekerja antrean email dimatikan; test email menyalakannya sendiri.
    env: {
      DATABASE_DRIVER: 'postgres',
      RATE_LIMIT_SCALE: '50',
      EMAIL_VERIFICATION: 'off',
      MAIL_WORKER: 'off',
    },
  },
});
