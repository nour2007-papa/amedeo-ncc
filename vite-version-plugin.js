// ضيف الجزء ده في vite.config.js

import { writeFileSync } from 'fs';

export function versionPlugin() {
  return {
    name: 'version-plugin',
    buildStart() {
      const version = Date.now().toString(); // أو استخدم git commit hash لو عايز
      writeFileSync('public/version.json', JSON.stringify({ version }));
    },
  };
}

// وفي vite.config.js:
// import { versionPlugin } from './vite-version-plugin.js';
// export default defineConfig({
//   plugins: [vue(), versionPlugin(), ...],
// });
