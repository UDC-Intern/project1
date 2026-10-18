import { defineConfig } from 'drizzle-kit';
import './src/common/env.js';
import { DEFAULT_DATABASE_URL } from './src/common/config.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL },
});
