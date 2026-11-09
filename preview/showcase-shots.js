// Renders the demo notes with the real plugin code (render.js, showcase.js) in an
// Obsidian-like dark page, and saves screenshots for the README.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const V = path.join(__dirname, '../demo-vault');
const P = path.join(__dirname, '../plugin');
const OUT = path.join(__dirname, '../docs/screenshots');
const read = (f) => { try { return fs.readFileSync(path.join(V, f), 'utf8'); } catch (e) { return ''; } };
const notes = {};
for (const f of fs.readdirSync(V)) if (f.endsWith('.md')) notes[f] = read(f);
const js = ['render.js', 'showcase.js'].map((f) => fs.readFileSync(path.join(P, f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(P, 'styles.css'), 'utf8');
const head = 'file://' + path.join(P, 'assets/knowledge-head.svg');

// Minimal Markdown → HTML for the preview: headings, paragraphs, lists, tables, code blocks become placeholders.
function md(src) {
  const out = []; const lines = src.split('\n'); let i = 0; let n = 0;
  const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a class="il">$2</a>').replace(/\[\[([^\]]+)\]\]/g, '<a class="il">$1</a>');
  while (i < lines.length) {
    const l = lines[i];
    const m = l.match(/^```(\S*)/);
    if (m) { const body = []; i++; while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]); i++; out.push(`<div class="blk" data-type="${m[1]}" data-src="${encodeURIComponent(body.join('\n'))}" id="b${n++}"></div>`); continue; }
    if (/^#{1,6}\s/.test(l)) { const k = l.match(/^#+/)[0].length; out.push(`<h${k}>${inline(l.replace(/^#+\s*/, ''))}</h${k}>`); i++; continue; }
    if (l.trim().startsWith('|')) { const rows = []; while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]); const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|'); out.push('<table><tr>' + cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr>' + rows.slice(2).map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table>'); continue; }
    if (/^\s*[-*] /.test(l)) { const it = []; while (i < lines.length && /^\s*[-*] /.test(lines[i])) it.push(lines[i++].replace(/^\s*[-*] /, '')); out.push('<ul>' + it.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>'); continue; }
    if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  return out.join('\n');
}

const run = `
const NOTES = window.NOTES; const S = MindOrgShow; const O = { open: () => {}, button: true };
const first = (src, fb) => (src.split('\\n').map((x) => x.trim()).find((x) => /\\.md$/i.test(x)) || fb);
document.querySelectorAll('.blk').forEach((el) => {
  const t = el.dataset.type, src = decodeURIComponent(el.dataset.src), note = window.NOTE;
  if (t === 'mo-header') S.renderHeader(el, src, { video: /waves\\s*:\\s*video/i.test(src) ? window.WAVE : null });
  else if (t === 'mo-goal') S.renderGoal(el, src);
  else if (t === 'mo-next') MindOrg.renderNext(el, NOTES['Deadlines.md'], { today: window.TODAY });
  else if (t === 'mo-deadlines') MindOrg.renderDeadlines(el, NOTES['Deadlines.md'], { today: window.TODAY });
  else if (t === 'mo-decisions') MindOrg.renderDecisions(el, NOTES['Decision Log.md'], { limit: 3 });
  else if (t === 'mo-competitors') MindOrg.renderCompetitors(el, src);
  else if (t === 'mo-knowledge') { const items = MindOrg.parseDeadlines(NOTES['Deadlines.md'], { today: window.TODAY });
    S.renderKnowledge(el, Object.assign({}, O, { head: window.HEAD, counts: { facts: S.tables(NOTES['Handbook.md'], 'Facts').length, decisions: MindOrg.parseDecisions(NOTES['Decision Log.md']).length,
      open: NOTES['Open Questions.md'].split('\\n').filter((l) => /^\\s*[-*] /.test(l)).length, sources: S.tables(NOTES['Handbook.md'], 'Sources').length, critical: items.filter((i) => i.state === 'late' || i.state === 'soon').length } })); }
  else if (t === 'mo-customers-stats') S.renderCustomerStats(el, S.tables(NOTES['Customers.md']), O);
  else if (t === 'mo-customers') S.renderCustomers(el, S.tables(NOTES['Customers.md']), src.split('\\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0] && r.length >= 2).map(([title, sub, target]) => ({ title, sub, target })), O);
  else if (t === 'mo-comp-marquee') S.renderCompMarquee(el, (NOTES['Competitors.md'].match(/\`\`\`mo-competitors\\n([\\s\\S]*?)\`\`\`/) || [, ''])[1], O);
  else if (t === 'mo-prices') S.renderPrices(el, S.tables(note, 'Prices'));
  else if (t === 'mo-timeline') S.renderTimeline(el, S.tables(NOTES[first(src, 'Road map.md')]), window.TODAY);
  else if (t === 'mo-team') S.renderTeam(el, src, O);
  else if (t === 'mo-chat') S.renderChat(el, src);
  else if (t === 'mo-daily') S.renderDaily(el, note, O);
  else if (t === 'mo-economy') S.renderEconomy(el, note, O);
});`;

const page = (file, wide) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;background:#1e1e1e;color:#dadada;font-family:Inter,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.5}
.note{max-width:${wide ? 1100 : 760}px;margin:0 auto;padding:30px 36px 60px}
h1{font-size:44px;font-weight:800;color:#c7ccf4;margin:10px 0 20px} h2{font-size:40px;font-weight:800;color:#c7ccf4;margin:44px 0 18px;padding-top:24px;border-top:1px solid #3a3a55}
p{color:#c9cbe0} a.il{color:#9aa6ff;text-decoration:none} table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0} th,td{border:1px solid #3a3a55;padding:6px 8px;text-align:left}
.mo-card{--mo-paper:#24243a;--mo-ink:#e8e8f4;--mo-ink-soft:#a3a6c2;--mo-line:#3a3a55;--mo-ivory:#2a2a40;--mo-olive:#c7ccf4;margin:14px 0}
.mo-comp{--mo-ink:#e8e8f4;--mo-ivory:#2a2a40;--mo-line:#3a3a55;--mo-olive:#c7ccf4}
</style></head><body><div class="note">${md(notes[file])}</div>
<script>window.NOTES=${JSON.stringify(notes)};window.NOTE=${JSON.stringify(notes[file])};window.TODAY='2026-11-09';window.HEAD=${JSON.stringify(head)};window.WAVE=${JSON.stringify('file://' + path.join(P, 'assets/wave.mp4'))};</script>
<script>${js}</script><script>${run}</script></body></html>`;

const shots = [
  { file: 'Control Room.md', out: 'demo-control-room.png' },
  { file: 'My Customers.md', out: 'demo-customers.png' },
  { file: 'Competitors.md', out: 'demo-competitors.png' },
  { file: 'My Daily.md', out: 'demo-daily.png', wide: true },
  { file: 'My Economy.md', out: 'demo-economy.png', wide: true },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  const only = process.argv[2];
  for (const s of shots) {
    if (only && !s.out.includes(only)) continue;
    const tmp = path.join(__dirname, '_' + s.out.replace('.png', '.html'));
    fs.writeFileSync(tmp, page(s.file, s.wide));
    await p.setViewportSize({ width: 1200, height: 900 });
    await p.goto('file://' + tmp);
    await p.waitForTimeout(1800);
    const hgt = await p.evaluate(() => document.querySelector('.note').getBoundingClientRect().height);
    await p.setViewportSize({ width: 1200, height: Math.min(5000, Math.ceil(hgt)) });
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(OUT, s.out) });
    fs.unlinkSync(tmp);
  }
  if (!only || only === 'start') {
    await p.setViewportSize({ width: 1372, height: 760 });
    await p.goto('file://' + path.join(P, 'assets/landing.html') + '#vault=Demo&name=Your%20Name');
    await p.waitForTimeout(5000);
    await p.screenshot({ path: path.join(OUT, 'demo-start.png') });
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'ok');
})();
