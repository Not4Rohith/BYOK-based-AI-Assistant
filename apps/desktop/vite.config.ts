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
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Splits core React libraries into their own chunk
          vendor: ['react', 'react-dom', 'scheduler'],
          // Splits KaTeX (which was taking up significant space in your build) into its own chunk
          math: ['katex'],
          // You can also split icons if you are using lucide-react heavily
          icons: ['lucide-react']
        }
      }
    }
  }
});