import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { versionPlugin } from './vite-version-plugin.js';

// تحويل CSS الرئيسي المُولّد من Vite (App-xxxx.css) من stylesheet
// عادي (render-blocking) إلى نمط preload + swap غير حاجب — نفس التكنيك
// المستخدم بالفعل مع Google Fonts في index.html.
function deferMainCssPlugin() {
  return {
    name: 'defer-main-css',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/,
        `<link rel="preload" as="style" crossorigin href="$1" onload="this.onload=null;this.rel='stylesheet'">` +
        `<noscript><link rel="stylesheet" crossorigin href="$1"></noscript>`
      );
    },
  };
}

export default defineConfig({
  plugins: [vue(), versionPlugin(), deferMainCssPlugin()],
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
