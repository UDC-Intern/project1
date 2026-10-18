import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Modul ini hanya mendeklarasikan tipe TypeScript, tidak memiliki perilaku runtime untuk diuji.
      exclude: ['src/index.ts', 'src/view/admin.ts'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
