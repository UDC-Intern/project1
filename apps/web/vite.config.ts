import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '../..',
  plugins: [react()],
  resolve: { conditions: ['source', 'module', 'browser', 'development|production'] },
  server: {
    host: '127.0.0.1',
    port: 6006,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7177',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    env: { VITE_MOCK_MODULES: '*' },
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
