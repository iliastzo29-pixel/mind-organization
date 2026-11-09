/*
 * Mind Organization — render functions for the vault's live blocks.
 *
 * Pure DOM, no Obsidian dependency, so the same code runs inside the
 * plugin (main.js) and in the static preview used for the screenshots.
 * Every block reads plain Markdown that a human (or an agent) wrote.
 * Nothing is typed into the dashboard by hand.
 */
(function (root) {
  'use strict';

  const h = (parent, tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };

  // [[Page|label]] -> Page, **bold** -> bold
  const clean = (t) => String(t || '')
    .replace(/\[\[([^\]|]+)\|?[^\]]*\]\]/g, '$1')
    .replace(/\*\*/g, '')
    .trim();

  // Split a Markdown table row. Escaped pipes (\|) inside links are not separators.
  const cells = (line) => line
    .replace(/\\\|/g, '\u0001')
    .split('|')
    .map((c) => c.replace(/\u0001/g, '|').trim());

  const DAY = 86400000;

  /* ---------- Deadlines ---------- */

  // Reads every table row whose first cell holds a date (DD.MM.YYYY).
  function parseDeadlines(text, today) {
    const now = today ? new Date(today) : new Date();
    now.setHours(0, 0, 0, 0);
    const out = [];
    for (const line of String(text || '').split('\n')) {
      if (!line.startsWith('|')) continue;
      const c = cells(line);
      if (c.length < 3) continue;
      const m = c[1].match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (!m) continue;
      const date = new Date(+m[3], +m[2] - 1, +m[1]);
      if (isNaN(date)) continue;
      const days = Math.round((date - now) / DAY);
      out.push({
        label: clean(c[1]),
        what: clean(c[2]),
        who: clean(c[3]),
        days,
        state: days < 0 ? 'late' : days <= 7 ? 'soon' : 'later',
      });
    }
    return out.sort((a, b) => a.days - b.days);
  }

  // Rows of the "## Waiting for an answer" table: | From | What | Since |
  function parseWaiting(text) {
    const out = [];
    let on = false;
    for (const line of String(text || '').split('\n')) {
      if (line.startsWith('## ')) { on = /waiting/i.test(line); continue; }
      if (!on || !line.startsWith('|')) continue;
      const c = cells(line);
      const who = clean(c[1]);
      if (!who || /^-+$/.test(who) || /^from$/i.test(who)) continue;
      out.push({ who, what: clean(c[2]), since: clean(c[3]) });
    }
    return out;
  }

  const when = (d) => d < 0 ? `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} overdue`
    : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;

  function row(el, label, what, meta, cls) {
    const r = h(el, 'div', 'mo-row ' + (cls || ''));
    h(r, 'span', 'mo-when', label);
    const b = h(r, 'div', 'mo-body');
    h(b, 'div', 'mo-what', what);
    if (meta) h(b, 'div', 'mo-meta', meta);
  }

  // ```mo-deadlines``` : only what is overdue or due within 7 days.
  function renderDeadlines(el, text, opts) {
    el.textContent = '';
    el.classList.add('mo-card');
    const items = parseDeadlines(text, opts && opts.today);
    const hot = items.filter((i) => i.state !== 'later');
    if (!hot.length) { h(el, 'div', 'mo-ok', 'Nothing is due this week.'); return; }
    for (const i of hot) row(el, i.label, i.what, when(i.days) + (i.who ? ' · ' + i.who : ''), 'mo-' + i.state);
  }

  // ```mo-next``` : the Control Room view. Overdue, this week, next two, and who we wait for.
  function renderNext(el, text, opts) {
    el.textContent = '';
    el.classList.add('mo-card');
    const items = parseDeadlines(text, opts && opts.today);
    const late = items.filter((i) => i.state === 'late');
    const soon = items.filter((i) => i.state === 'soon');
    const later = items.filter((i) => i.state === 'later').slice(0, 2);
    h(el, 'div', 'mo-head', 'Next steps');
    for (const i of late) row(el, i.label, i.what, when(i.days) + (i.who ? ' · ' + i.who : ''), 'mo-late');
    for (const i of soon) row(el, i.label, i.what, when(i.days) + (i.who ? ' · ' + i.who : ''), 'mo-soon');
    for (const i of later) row(el, i.label, i.what, i.who, '');
    if (!items.length) h(el, 'div', 'mo-ok', 'No deadlines.');
    const waiting = parseWaiting(text);
    if (waiting.length) {
      h(el, 'div', 'mo-head', 'Waiting for an answer');
      for (const w of waiting) row(el, w.who, w.what, w.since ? 'since ' + w.since : '', 'mo-wait');
    }
    h(el, 'div', 'mo-src', 'Calculated live from the Deadlines page. Nobody types this by hand.');
  }

  /* ---------- Decision log ---------- */

  // Headings like: ### DEC-OPS-004 · Title   followed by "- **Decision:** ..." and "- **Approved:** ..."
  function parseDecisions(text) {
    const out = [];
    let cur = null;
    for (const line of String(text || '').split('\n')) {
      const m = line.match(/^###\s+(DEC-[A-Z]+-\d+)\s*·\s*(.+)$/);
      if (m) { cur = { id: m[1], title: m[2].trim(), decision: '', approved: '' }; out.push(cur); continue; }
      if (!cur) continue;
      const d = line.match(/^-\s*\*\*Decision:\*\*\s*(.+)$/i);
      if (d) cur.decision = clean(d[1]);
      const a = line.match(/^-\s*\*\*Approved:\*\*\s*(.+)$/i);
      if (a) cur.approved = clean(a[1]);
    }
    return out;
  }

  // ```mo-decisions``` : the latest N decisions as cards (first line of the block = N).
  function renderDecisions(el, text, opts) {
    el.textContent = '';
    el.classList.add('mo-card');
    const n = (opts && opts.limit) || 4;
    const all = parseDecisions(text);
    h(el, 'div', 'mo-head', `Decision log · ${all.length} decisions`);
    for (const d of all.slice(0, n)) {
      const r = h(el, 'div', 'mo-dec');
      const top = h(r, 'div', 'mo-dec-top');
      h(top, 'span', 'mo-dec-id', d.id);
      h(top, 'span', 'mo-dec-title', d.title);
      if (d.decision) h(r, 'div', 'mo-dec-text', d.decision);
      if (d.approved) h(r, 'div', 'mo-meta', 'Approved: ' + d.approved);
    }
  }

  /* ---------- Competitors ---------- */

  // ```mo-competitors
  // ## 🇨🇭 Switzerland
  // Name | product link | logo link (optional)
  // ```
  function renderCompetitors(el, source) {
    el.textContent = '';
    el.classList.add('mo-comp');
    let grid = null;
    const lines = String(source || '').split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('#')) {
        h(el, 'div', 'mo-comp-group', line.replace(/^#+\s*/, ''));
        grid = h(el, 'div', 'mo-comp-grid');
        continue;
      }
      if (!grid) grid = h(el, 'div', 'mo-comp-grid');
      const [name, url, logo] = line.split('|').map((x) => (x || '').trim());
      if (!name) continue;
      const tile = h(grid, 'a', 'mo-comp-tile');
      if (url) { tile.href = url; tile.target = '_blank'; tile.rel = 'noopener'; }
      const circle = h(tile, 'div', 'mo-comp-circle');
      const initials = () => {
        circle.textContent = '';
        const show = (typeof window !== 'undefined' && window.MindOrgShow) || root.MindOrgShow;
        if (show) { circle.innerHTML = show.logoSVG(name); return; }
        h(circle, 'span', 'mo-comp-initials', name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
      };
      if (logo) {
        const img = h(circle, 'img');
        img.src = logo; img.alt = name; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', initials);
      } else initials();
      h(tile, 'div', 'mo-comp-name', name);
    }
  }

  const api = { parseDeadlines, parseWaiting, parseDecisions, renderDeadlines, renderNext, renderDecisions, renderCompetitors };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MindOrg = api;
})(typeof window !== 'undefined' ? window : globalThis);
