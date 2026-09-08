import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        'pixilive-nova': resolve(__dirname, 'src/sdk/embed.ts'),
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
