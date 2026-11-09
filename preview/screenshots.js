// Renders the demo notes with the real render.js and saves screenshots for the README.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const V = path.join(__dirname, '../demo-vault');
const read = (f) => fs.readFileSync(path.join(V, f), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../plugin/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../plugin/render.js'), 'utf8');
const TODAY = '2026-11-09';

const page = (title, sub, body) => `<!doctype html><html><head><meta charset="utf-8">
<style>${css}
body{margin:0;background:#f7f4ef;font-family:Inter,-apple-system,sans-serif;color:#1f231b}
.note{max-width:720px;margin:0 auto;padding:36px 40px 40px}
h1{font-size:26px;font-weight:600;margin:0 0 4px} .sub{color:#4b4f42;font-size:13px;margin-bottom:20px}
.gap{height:16px} .links{font-size:13px;color:#596044;margin-top:18px}
</style></head><body><div class="note"><h1>${title}</h1><div class="sub">${sub}</div>${body}</div>
<script>${js}</script><script>window.__run && window.__run()</script></body></html>`;

const shots = [
  { file: 'control-room.png', html: page('🎛 Control Room', 'The page that opens first. Everything on it is calculated from the other notes.',
      `<div id="a"></div><div class="gap"></div><div id="b"></div><div class="links">Deadlines · Decision Log · Journal · Competitors · Rules · Project Owner · Hermes</div>`),
    run: `MindOrg.renderNext(document.getElementById('a'), ${JSON.stringify(read('Deadlines.md'))}, {today:'${TODAY}'});
          MindOrg.renderDecisions(document.getElementById('b'), ${JSON.stringify(read('Decision Log.md'))}, {limit:3});` },
  { file: 'deadlines.png', html: page('⏰ Deadlines', 'Only what is overdue or due within seven days. The tables below the block are the source.', `<div id="a"></div>`),
    run: `MindOrg.renderDeadlines(document.getElementById('a'), ${JSON.stringify(read('Deadlines.md'))}, {today:'${TODAY}'});` },
  { file: 'competitors.png', html: page('🔎 Competitors', 'One line per competitor in the note. The tiles are drawn by the plugin.', `<div id="a"></div>`),
    run: `MindOrg.renderCompetitors(document.getElementById('a'), ${JSON.stringify((read('Competitors.md').match(/```mo-competitors\n([\s\S]*?)```/) || [,''])[1])});` },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
  fs.mkdirSync(path.join(__dirname, '../docs/screenshots'), { recursive: true });
  for (const s of shots) {
    const html = s.html.replace('window.__run && window.__run()', s.run);
    fs.writeFileSync(path.join(__dirname, s.file.replace('.png', '.html')), html);
    await p.setContent(html);
    await p.waitForTimeout(200);
    const h = await p.evaluate(() => document.querySelector('.note').getBoundingClientRect().height);
    await p.setViewportSize({ width: 800, height: Math.ceil(h) });
    await p.screenshot({ path: path.join(__dirname, '../docs/screenshots', s.file) });
  }
  await b.close();
  console.log('ok');
})();
