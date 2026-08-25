// src/composables/useVersionCheck.js
// استخدمه مرة واحدة في App.vue: import { useVersionCheck } from './composables/useVersionCheck'; useVersionCheck();

import { onMounted, onUnmounted } from 'vue';

export function useVersionCheck(intervalMs = 60000) {
  let currentVersion = null;
  let intervalId = null;

  async function checkVersion() {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();

      if (currentVersion === null) {
        currentVersion = data.version;
        return;
      }

      if (data.version !== currentVersion) {
        console.log('[VersionCheck] نسخة جديدة متاحة، إعادة تحميل الصفحة...');
        window.location.reload();
      }
    } catch (err) {
      // فشل الفحص (offline مثلًا) - تجاهل بصمت
    }
  }

  onMounted(() => {
    checkVersion(); // فحص أولي لتسجيل النسخة الحالية
    intervalId = setInterval(checkVersion, intervalMs);
  });

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId);
  });
}
