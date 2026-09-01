import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/collab': { target: 'ws://localhost:8000', ws: true }
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // 仅把 react 运行时独立为稳定 vendor chunk（提升缓存命中）；
        // 富文本/协作重型依赖随编辑器 React.lazy 动态加载，不再进入首屏。
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }
          return undefined;
        }
      }
    }
  }
});
