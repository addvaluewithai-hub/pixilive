import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(rootDir, 'index.html'),
        'pixilive-nova': resolve(rootDir, 'src/sdk/embed.ts'),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === 'pixilive-nova'
          ? 'sdk/pixilive-nova.js'
          : 'assets/[name]-[hash].js',
        chunkFileNames: 'sdk/chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
