import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '../..',
  plugins: [react()],
  resolve: { conditions: ['source', 'module', 'browser', 'development|production'] },
  server: {
    port: 6006,
    proxy: {
      '/api': {
        target: 'http://localhost:7177',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
