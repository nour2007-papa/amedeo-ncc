// scripts/prerender.js
//
// بيتنفذ بعد "vite build" (كـ postbuild). بيفتح نسخة "vite preview" محليًا،
// يزور كل route بمتصفح headless (Puppeteer)، وبعد ما الصفحة تخلص render
// (بما فيها الـ title/meta اللي بيتغيروا في App.vue حسب اللغة)، بياخد
// نسخة من الـ HTML النهائي ويحفظها في dist/<route>/index.html.
//
// النتيجة: Google (وأي بوت) بيلاقي HTML جاهز فيه المحتوى والـ meta الصح
// لكل لغة، من غير ما يستنى تنفيذ الـ JavaScript.

import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// عدّل القايمة دي لو ضفت صفحات/لغات جديدة
const ROUTES = [
  '/',
  '/en',
  '/ar',
  '/aeroporti/malpensa',
  '/en/aeroporti/malpensa',
  '/ar/aeroporti/malpensa',
  '/aeroporti/linate',
  '/en/aeroporti/linate',
  '/ar/aeroporti/linate',
  '/aeroporti/bergamo',
  '/en/aeroporti/bergamo',
  '/ar/aeroporti/bergamo',
];

const PORT = 4173;

// على Vercel (بيئة Linux serverless) بنستخدم Chromium خفيف متوافق مع serverless.
// محليًا (ويندوز/ماك) بنستخدم Puppeteer العادي.
async function getBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteerCore = (await import('puppeteer-core')).default;
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  const puppeteer = (await import('puppeteer')).default;
  return puppeteer.launch({ args: ['--no-sandbox'] });
}

async function run() {
  const server = await preview({ preview: { port: PORT, strictPort: true } });
  const base = `http://localhost:${PORT}`;

  const browser = await getBrowser();

  for (const route of ROUTES) {
    const page = await browser.newPage();
    try {
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
      // مهلة صغيرة إضافية عشان Vue يخلص أي render/watch متأخر (زي تحديث الـ title)
      await new Promise((r) => setTimeout(r, 300));
      const html = await page.content();

      const outDir = path.join('dist', route === '/' ? '' : route);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');
      console.log(`✓ Prerendered: ${route}`);
    } catch (err) {
      console.error(`✗ فشل الـ prerender لـ ${route}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.httpServer.close();
}

run();
