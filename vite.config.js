import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Only use the subpath for production builds (GitHub Pages).
  // Dev server always serves from root so port-forwarding works.
  base: command === 'build' ? '/bjj-app-prototype/' : '/',
  build: {
    outDir: 'docs',
  },
}));
