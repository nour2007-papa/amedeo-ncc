import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { versionPlugin } from './vite-version-plugin.js';

export default defineConfig({
  plugins: [vue(), versionPlugin()],
  build: {
    // السطر الجديد لإخفاء التحذير الأصفر (رفع الحد إلى 1 ميجابايت)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // حافظنا على نفس الكود الخاص بك لفصل ملفات فايربيز
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
        }
      }
    }
  }
});
