// Renders the setup questions (plugin/setup.js) and saves two screenshots for the README.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../plugin/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../plugin/setup.js'), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
:root{--background-primary:#1e1e2a;--text-normal:#e6e4ee;--text-muted:#9a98aa;--background-modifier-border:#3a3a4a}
body{margin:0;background:#14141c;font-family:Inter,-apple-system,sans-serif;padding:28px}
.modal{box-sizing:border-box;width:100%;max-width:660px;margin:0 auto;background:#1e1e2a;border:1px solid #3a3a4a;border-radius:12px;padding:22px 24px 18px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
</style></head><body><div class="modal" id="m"></div><script>${js}</script></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.evaluate(() => {
    window.w = MindOrgSetup.renderWizard(document.getElementById('m'), {});
    Object.assign(window.w.answers, { name: 'Alex Meyer', country: 'Switzerland', projects: ['company', 'personal'], model: 'Claude' });
    window.w.go(0);
  });
  const shot = async (file) => {
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.setViewportSize({ width: 700, height: h });
    await p.screenshot({ path: path.join(__dirname, '../docs/screenshots', file) });
  };
  await shot('setup-start.png');
  await p.evaluate(() => {
    Object.assign(window.w.answers, { company: 'Olive & Co', product: 'Greek olive oil for restaurants in Zurich', stage: 'Preparing the first sale', legal: 'Sole trader', goal: 'First legal sale, with all papers in order', goalDate: '31.03.2027' });
    window.w.go(1);
  });
  await shot('setup-company.png');
  await b.close();
  console.log('ok');
})();
