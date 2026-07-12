import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 避免已有旧 Vite 进程占用 5173 后自动漂移到 5174，导致浏览器仍打开旧页面。
    strictPort: true
  }
});
