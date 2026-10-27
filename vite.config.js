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


// Preload del chunk di App.vue (+ dipendenze e CSS) già dall'HTML: evita la
// cascata index.html -> main.js -> App-xxx.js/css che ritarda l'LCP.
// Nota: viene precaricato anche su /aeroporti/* e sulla pagina gestione.
function preloadAppChunkPlugin() {
  return {
    name: 'preload-app-chunk',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        try {
          if (!ctx || !ctx.bundle) return html; // dev server: nessun bundle
          const app = Object.values(ctx.bundle).find(
            (c) => c.type === 'chunk' && c.isDynamicEntry && c.facadeModuleId && /[\\/]src[\\/]App\.vue$/.test(c.facadeModuleId)
          );
          if (!app) return html;
          const tags = [`<link rel="modulepreload" crossorigin href="/${app.fileName}">`];
          for (const imp of app.imports || []) {
            tags.push(`<link rel="modulepreload" crossorigin href="/${imp}">`);
          }
          for (const css of (app.viteMetadata && app.viteMetadata.importedCss) || []) {
            tags.push(`<link rel="preload" as="style" crossorigin href="/${css}">`);
          }
          return html.replace('</head>', `  ${tags.join('\n  ')}\n</head>`);
        } catch (e) {
          return html;
        }
      },
    },
  };
}

export default defineConfig({
  plugins: [vue(), versionPlugin(), deferMainCssPlugin(), preloadAppChunkPlugin()],
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
