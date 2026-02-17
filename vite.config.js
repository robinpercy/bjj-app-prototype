import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Use relative paths so docs/ works from any URL (GitHub Pages, raw.githack permalinks, etc).
  // Dev server always serves from root so port-forwarding works.
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'docs',
  },
}));
