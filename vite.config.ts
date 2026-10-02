/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://chris00zeng.github.io/distributed-rng-demo/ on GitHub Pages,
// so assets must resolve under that sub-path. Vite dev server ignores it.
export default defineConfig({
  base: '/distributed-rng-demo/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
