import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ai-task-manager/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000
  }
});
