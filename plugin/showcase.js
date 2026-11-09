/*
 * Mind Organization — showcase blocks (pure DOM, no Obsidian dependency).
 * The same look as the author's own vault, drawn entirely in code:
 * header with particle waves, goal countdown, My Knowledge, customers and
 * competitors with logos that scroll past, price chart, road map, team,
 * My Daily and My Economy. All data comes from plain Markdown tables.
 */
(function (root) {
  const h = (parent, tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  };
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  const opener = (opts, target) => (e) => { e.preventDefault(); if (opts && opts.open) opts.open(target); };
  const link = (parent, cls, text, target, opts) => { const a = h(parent, 'a', cls, text); a.href = '#'; a.addEventListener('click', opener(opts, target)); return a; };

  /* ---------- small parsers ---------- */
  // All markdown tables of a note (or only the one under a heading) → arrays of row objects keyed by header.
  function tables(text, heading) {
    let src = String(text || '');
    if (heading) {
      const i = src.search(new RegExp('^#+\\s*' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'mi'));
      if (i < 0) return [];
      const rest = src.slice(i).split('\n'); rest.shift();
      const end = rest.findIndex((l) => /^#{1,6}\s/.test(l));
      src = (end < 0 ? rest : rest.slice(0, end)).join('\n');
    }
    const out = []; let head = null;
    for (const raw of src.split('\n')) {
      const l = raw.trim();
      if (!l.startsWith('|')) { head = null; continue; }
      const cells = l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim().replace(/\*\*/g, ''));
      if (!head) { head = cells.map((c) => c.toLowerCase()); continue; }
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      const row = {}; head.forEach((k, i) => { row[k] = cells[i] || ''; }); out.push(row);
    }
    return out;
  }
  const kv = (source) => {
    const o = {};
    String(source || '').split('\n').forEach((l) => { const m = l.match(/^\s*([a-z]+)\s*:\s*(.+)$/i); if (m) o[m[1].toLowerCase()] = m[2].trim(); });
    return o;
  };
  const num = (s) => parseFloat(String(s || '').replace(/[^0-9.\-]/g, '')) || 0;
  const money = (n) => n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- invented logos, drawn as SVG ---------- */
  const hash = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
  const PAL = [['#f4efe6', '#3b2f2a'], ['#1d1d1f', '#f2e3c6'], ['#e9f1ec', '#2f5d46'], ['#f7e7e3', '#9b2c2c'], ['#eef0f8', '#2c3e7a'], ['#fff8e6', '#8a6a1f'], ['#111827', '#93c5fd'], ['#f3e8ff', '#6b21a8']];
  const ICONS = {
    fork: '<path d="M38 26v14M44 26v14M50 26v14M38 40q6 6 12 0M44 46v28" stroke-width="3" fill="none" stroke-linecap="round"/>',
    leaf: '<path d="M30 70C30 44 50 30 72 30c0 24-14 42-42 40zM34 66l26-26" stroke-width="3" fill="none" stroke-linecap="round"/>',
    star: '<path d="M50 24l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" stroke-width="3" fill="none" stroke-linejoin="round"/>',
    hat: '<path d="M32 60h36v8H32zM34 60c-8-6-4-20 8-18 2-8 14-8 16 0 12-2 16 12 8 18" stroke-width="3" fill="none" stroke-linejoin="round"/>',
    mountain: '<path d="M22 70l18-26 10 12 8-10 20 24z" stroke-width="3" fill="none" stroke-linejoin="round"/>',
    wave: '<path d="M24 52c8-8 14-8 22 0s14 8 22 0M24 64c8-8 14-8 22 0s14 8 22 0" stroke-width="3" fill="none" stroke-linecap="round"/>',
  };
  function logoSVG(name, kind) {
    const k = hash(name); const [bg, fg] = PAL[k % PAL.length];
    const words = String(name).replace(/[^A-Za-zÀ-ÿ0-9 &]/g, '').split(/\s+/).filter(Boolean);
    const ini = (words[0] || '?')[0] + (words[1] ? words[1][0] : '');
    const style = k % 3;
    const iconKey = kind || Object.keys(ICONS)[k % Object.keys(ICONS).length];
    let inner;
    if (style === 0) inner = `<g stroke="${fg}" opacity=".9">${ICONS[iconKey] || ICONS.star}</g>`;
    else if (style === 1) inner = `<text x="50" y="62" text-anchor="middle" font-family="Georgia,serif" font-size="34" font-style="italic" fill="${fg}">${ini}</text>`;
    else inner = `<circle cx="50" cy="50" r="30" fill="none" stroke="${fg}" stroke-width="2"/><text x="50" y="58" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="22" letter-spacing="1" fill="${fg}">${ini.toUpperCase()}</text>`;
    const word = words.slice(0, 2).join(' ').toUpperCase().slice(0, 16);
    const sub = style === 0 ? `<text x="50" y="86" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="8" letter-spacing="1.2" fill="${fg}">${word}</text>` : '';
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="${bg}"/>${inner}${sub}</svg>`;
  }
  const logo = (parent, name, kind, cls) => { const d = h(parent, 'div', cls || 'mox-logo'); d.innerHTML = logoSVG(name, kind); return d; };

  /* ---------- animation helper: stops when the block leaves the page ---------- */
  function animate(el, canvas, draw, fps) {
    const ctx = canvas.getContext('2d'); let t0 = performance.now(); let last = 0; const step = 1000 / (fps || 30);
    const fit = () => { const r = canvas.getBoundingClientRect(); const d = window.devicePixelRatio || 1; canvas.width = Math.max(2, r.width * d); canvas.height = Math.max(2, r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); return r; };
    let box = fit();
    const loop = (now) => {
      if (!canvas.isConnected && performance.now() - t0 > 3000) return;
      if (now - last >= step) {
        last = now;
        if (canvas.width < 4 || Math.abs(canvas.getBoundingClientRect().width - box.width) > 1) box = fit();
        if (!document.hidden) draw(ctx, box.width, box.height, (now - t0) / 1000);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- 1. Header with particle waves ---------- */
  function renderHeader(el, source, opts) {
    clear(el); el.classList.add('mox-header');
    const o = kv(source);
    if (opts && opts.video) {
      for (const side of ['l', 'r']) {
        const w = h(el, 'div', `mox-wing mox-wing-v mox-wing-${side}`);
        const v = h(w, 'video'); v.src = opts.video; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.addEventListener('loadeddata', () => v.play().catch(() => {}));
      }
    } else for (const side of ['l', 'r']) {
      const c = h(el, 'canvas', `mox-wing mox-wing-${side}`);
      const dir = side === 'l' ? 1 : -1;
      animate(el, c, (x, w, hh, t) => {
        x.clearRect(0, 0, w, hh);
        const rows = 26, cols = 70;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const u = i / (cols - 1); const v = j / (rows - 1) - 0.5;
            const env = Math.pow(dir > 0 ? u : 1 - u, 1.6);
            const y = hh / 2 + Math.sin(u * 7 * dir + t * 1.3 + j * 0.12) * hh * 0.30 * env + v * hh * 0.42 * env * (0.6 + 0.4 * Math.sin(t + u * 4));
            const a = 0.10 + 0.55 * env * (1 - Math.abs(v) * 1.4);
            x.fillStyle = `rgba(226,226,240,${Math.max(0, a)})`;
            x.fillRect(u * w, y, 1.3, 1.3);
          }
        }
      }, 30);
    }
    const mark = h(el, 'div', 'mox-symbol');
    mark.innerHTML = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M32 6c12 0 22 9 22 21 0 9-5 14-6 20-1 7-7 11-16 11S17 54 16 47c-1-6-6-11-6-20C10 15 20 6 32 6z"/><path d="M22 22l10-6 10 6v12l-10 6-10-6zM32 16v24M22 22l20 12M42 22L22 34M27 44l5 8 5-8"/></svg>';
    h(el, 'div', 'mox-word', o.title || 'my company');
    h(el, 'div', 'mox-tag', o.tag || 'Development · Control Room');
    if (o.button) {
      const b = h(el, 'a', 'mox-site'); b.href = o.link || '#'; b.target = '_blank'; b.rel = 'noopener';
      b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
      h(b, 'span', null, o.button);
    }
  }

  /* ---------- 2. Goal with live countdown ---------- */
  function renderGoal(el, source) {
    clear(el); el.classList.add('mox-goal');
    const o = kv(source);
    h(el, 'div', 'mox-goal-k', o.label || 'Our goal');
    h(el, 'div', 'mox-goal-t', o.text || 'First sale');
    const c = h(el, 'div', 'mox-goal-c');
    const target = o.date ? new Date(o.date + 'T09:00:00') : null;
    const tick = () => {
      if (!target) return;
      let s = Math.max(0, Math.floor((target - new Date()) / 1000));
      const d = Math.floor(s / 86400); s %= 86400; const hh = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
      c.innerHTML = `<b>${d}</b>days <b>${hh}</b>h <b>${m}</b>m <b>${s}</b> sec`;
      if (c.isConnected || !el.dataset.started) { el.dataset.started = '1'; setTimeout(tick, 1000); }
    };
    tick();
  }

  /* ---------- 3. Section title (big heading with an optional picture) ---------- */
  function sectionTitle(el, text, cls) { return h(el, 'div', 'mox-sec ' + (cls || ''), text); }

  /* ---------- 4. My Knowledge ---------- */
  // opts.counts = { facts, decisions, open, sources, critical }, opts.head = image url, opts.links = {...}
  function renderKnowledge(el, opts) {
    clear(el); el.classList.add('mox-know');
    const top = h(el, 'div', 'mox-know-top');
    const f = h(top, 'div', 'mox-formulas');
    ['e^{iπ} + 1 = 0', 'λ = h/p', 'x = −b/2a', 'p = mv', '∇·E = ρ/ε₀', 'S = k ln W', 'Δx Δp ≥ ħ/2', '∇×E = −∂B/∂t', 'E = mc²', 'Σ 1/n² = π²/6'].forEach((t, i) => {
      const s = h(f, 'span', null, t); s.style.left = `${(i * 37) % 88}%`; s.style.top = `${(i * 23) % 70}%`;
    });
    if (opts && opts.head) { const img = h(top, 'img', 'mox-know-head'); img.src = opts.head; img.alt = ''; }
    link(top, 'mox-know-title', 'My Knowledge', (opts && opts.links && opts.links.title) || 'Handbook/Handbook', opts);
    const c = (opts && opts.counts) || {};
    const grid = h(el, 'div', 'mox-know-grid');
    [['Facts', c.facts, 'What we know', 'facts'], ['Decisions', c.decisions, 'Decision Log', 'decisions'], ['Open', c.open, 'Questions', 'open'], ['Sources', c.sources, 'Handbook', 'sources'], ['Critical', c.critical, 'List', 'critical']].forEach(([k, v, b, key]) => {
      const cell = h(grid, 'div', 'mox-know-cell');
      h(cell, 'div', 'mox-know-k', k); h(cell, 'div', 'mox-know-v', String(v == null ? '—' : v));
      link(cell, 'mox-btn', b, (opts && opts.links && opts.links[key]) || '', opts);
    });
    link(el, 'mox-btn mox-wide', 'Show me what I know', (opts && opts.links && opts.links.title) || 'Handbook/Handbook', opts);
  }

  /* ---------- 5. Customers: counters and logos that pass by ---------- */
  function customerCounts(rows) {
    return {
      total: rows.length,
      truffle: rows.filter((r) => /yes|✅/i.test(r['serves truffle'] || '')).length,
      email: rows.filter((r) => /@/.test(r.email || '')).length,
      contact: rows.filter((r) => /sent|replied|meeting|customer/i.test(r.status || '')).length,
    };
  }
  function counters(parent, items) {
    const g = h(parent, 'div', 'mox-stats');
    items.forEach(([v, k]) => { const c = h(g, 'div', 'mox-stat'); h(c, 'div', 'mox-stat-v', String(v)); h(c, 'div', 'mox-stat-k', k); });
    return g;
  }
  function marquee(parent, items, speed) {
    const wrap = h(parent, 'div', 'mox-marquee');
    const track = h(wrap, 'div', 'mox-track');
    track.style.animationDuration = `${Math.max(18, items.length * (speed || 3.2))}s`;
    for (let pass = 0; pass < 2; pass++) {
      items.forEach((it) => {
        const t = h(track, 'div', 'mox-mtile');
        logo(t, it.name, it.kind, 'mox-logo mox-logo-lg');
        h(t, 'div', 'mox-mname', it.name);
        if (it.sub) h(t, 'div', 'mox-msub', it.sub);
      });
    }
    return wrap;
  }
  const kindOf = (type) => (/hotel/i.test(type) ? 'hat' : /catering|deli/i.test(type) ? 'leaf' : /michelin|fine/i.test(type) ? 'star' : /greek|taverna/i.test(type) ? 'wave' : 'fork');
  function renderCustomerStats(el, rows, opts) {
    clear(el); el.classList.add('mox-cust');
    const c = customerCounts(rows);
    counters(el, [[c.total, 'potential customers'], [c.truffle, 'serve truffle'], [c.email, 'with email'], [c.contact, 'in contact']]);
    marquee(el, rows.map((r) => ({ name: r.name, kind: kindOf(r.type), sub: r.place })), 2.6);
    if (opts && opts.button !== false) link(el, 'mox-btn mox-wide', 'Show me my customers', 'My Customers', opts);
  }

  /* ---------- 6. My Customers page ---------- */
  function renderCustomers(el, rows, lists, opts) {
    clear(el); el.classList.add('mox-crm');
    if (lists && lists.length) {
      const ul = h(el, 'div', 'mox-lists');
      lists.forEach((l, i) => {
        const a = link(ul, 'mox-list', null, l.target || '', opts);
        h(a, 'span', 'mox-list-n', String(i + 1));
        const b = h(a, 'span', 'mox-list-b'); h(b, 'span', 'mox-list-t', l.title); h(b, 'span', 'mox-list-s', l.sub || '');
        h(a, 'span', 'mox-list-go', '›');
      });
    }
    const c = customerCounts(rows);
    counters(el, [[c.total, 'potential customers'], [c.truffle, 'serve truffle'], [c.email, 'with email'], [c.contact, 'in contact']]);
    const uniq = (k) => ['all'].concat([...new Set(rows.map((r) => r[k]).filter(Boolean))].sort());
    const f = h(el, 'div', 'mox-filters');
    const state = { place: 'all', type: 'all', status: 'all', q: '' };
    const sel = (label, key, values) => {
      const box = h(f, 'label', 'mox-filter'); h(box, 'span', 'mox-filter-k', label);
      const s = h(box, 'select', 'mox-select'); values.forEach((v) => { const o = h(s, 'option', null, v); o.value = v; });
      s.addEventListener('change', () => { state[key] = s.value; draw(); });
    };
    sel('Canton', 'place', uniq('place')); sel('Category', 'type', uniq('type')); sel('Status', 'status', uniq('status'));
    const q = h(el, 'input', 'mox-search'); q.type = 'search'; q.placeholder = 'search…';
    q.addEventListener('input', () => { state.q = q.value.toLowerCase(); draw(); });
    const sum = h(el, 'div', 'mox-sum');
    const list = h(el, 'div', 'mox-cards');
    function draw() {
      clear(list);
      const shown = rows.filter((r) => (state.place === 'all' || r.place === state.place) && (state.type === 'all' || r.type === state.type) && (state.status === 'all' || r.status === state.status) && (!state.q || JSON.stringify(r).toLowerCase().includes(state.q)));
      const cc = customerCounts(shown);
      sum.textContent = `${shown.length} of ${rows.length}  ·  truffle ${cc.truffle}  ·  with email ${cc.email}  ·  in contact ${cc.contact}`;
      shown.forEach((r) => {
        const card = h(list, 'div', 'mox-card');
        logo(card, r.name, kindOf(r.type));
        const b = h(card, 'div', 'mox-card-b');
        h(b, 'div', 'mox-card-t', r.name + (/yes|✅/i.test(r['serves truffle'] || '') ? ' ✅' : ''));
        h(b, 'div', 'mox-card-m', [r.type, r.place, r.phone].filter(Boolean).join(' · '));
        if (r.website) h(b, 'div', 'mox-card-l', '🌐 ' + r.website);
        if (r.email) h(b, 'div', 'mox-card-l', r.email);
        if (r.note) h(b, 'div', 'mox-card-n', r.note);
        const side = h(card, 'div', 'mox-card-s');
        h(side, 'span', 'mox-pill mox-pill-' + (r.status || '').toLowerCase().replace(/\s+/g, '-'), r.status || '—');
        if (r['last contact']) h(side, 'div', 'mox-card-d', r['last contact']);
      });
    }
    draw();
  }

  /* ---------- 7. Competitors: carousel and price chart ---------- */
  function competitorLines(source) {
    let group = '';
    return String(source || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      if (l.startsWith('#')) { group = l.replace(/^#+\s*/, ''); return null; }
      const [name, url] = l.split('|').map((x) => (x || '').trim());
      return name ? { name, url, group } : null;
    }).filter(Boolean);
  }
  function renderCompMarquee(el, source, opts) {
    clear(el); el.classList.add('mox-cust');
    marquee(el, competitorLines(source).map((c) => ({ name: c.name, sub: c.group.replace(/^[^A-Za-z]+/, '') })), 3);
    if (opts && opts.button !== false) link(el, 'mox-btn mox-wide', 'Show me my competitors', 'Competitors', opts);
  }
  const BAR = ['#e07a7a', '#f0a6b8', '#a6c46a', '#9aa0aa', '#d9b65c', '#a68be0', '#5fb3a5', '#e8a0a0', '#c79ad6', '#6fb6e8', '#e07a7a'];
  function renderPrices(el, rows) {
    clear(el); el.classList.add('mox-prices');
    const data = rows.map((r) => ({ trader: r.trader, country: r.country, truffle: r.truffle, price: num(r['chf per 100 g']), ok: !/no|❌/i.test(r.available || '') })).filter((r) => r.price > 0).sort((a, b) => b.price - a.price);
    const card = h(el, 'div', 'mox-pcard');
    const head = h(card, 'div', 'mox-phead');
    const tt = h(head, 'div'); h(tt, 'div', 'mox-ptitle', 'Chart · what 100 g costs'); h(tt, 'div', 'mox-psub', `${data.length} prices in CHF · public price lists, collected by the price guardian`);
    const body = h(card, 'div', 'mox-pbody');
    const chart = h(body, 'div', 'mox-chart');
    const max = Math.max(...data.map((d) => d.price), 1); const top = Math.ceil(max / 200) * 200;
    const axis = h(chart, 'div', 'mox-axis'); for (let v = top; v >= 0; v -= top / 4) h(axis, 'div', null, String(Math.round(v)));
    const bars = h(chart, 'div', 'mox-bars');
    const traders = [...new Set(data.map((d) => d.trader))];
    data.forEach((d) => {
      const col = h(bars, 'div', 'mox-col');
      const bar = h(col, 'div', 'mox-bar' + (d.ok ? '' : ' mox-bar-off'));
      bar.style.height = `${(d.price / top) * 100}%`; bar.style.background = BAR[traders.indexOf(d.trader) % BAR.length];
      h(bar, 'span', 'mox-bar-v', String(Math.round(d.price)));
      const lab = h(col, 'div', 'mox-col-l'); logo(lab, d.trader, null, 'mox-logo mox-logo-sm'); h(lab, 'div', null, d.trader); h(lab, 'div', 'mox-col-s', d.truffle);
    });
    const leg = h(body, 'div', 'mox-legend'); h(leg, 'div', 'mox-legend-t', 'Traders in the chart'); h(leg, 'div', 'mox-legend-s', 'their cheapest price (number of prices)');
    traders.slice().sort((a, b) => Math.min(...data.filter((d) => d.trader === a).map((d) => d.price)) - Math.min(...data.filter((d) => d.trader === b).map((d) => d.price))).forEach((t) => {
      const ps = data.filter((d) => d.trader === t).map((d) => d.price);
      const r = h(leg, 'div', 'mox-legend-r'); const dot = h(r, 'span', 'mox-dot'); dot.style.background = BAR[traders.indexOf(t) % BAR.length];
      h(r, 'span', 'mox-legend-n', t); h(r, 'span', 'mox-legend-p', `${money(Math.min(...ps))} (${ps.length})`);
    });
    h(card, 'div', 'mox-pnote', 'Striped bar = sold out or out of season on the site');
    // table
    const tab = h(el, 'div', 'mox-ptable');
    const hd = h(tab, 'div', 'mox-prow mox-prow-h');
    [['Truffle', 'type'], ['Trader', 'shop · country'], ['Price', 'CHF per 100 g'], ['Available', 'on the site today']].forEach(([a, b]) => { const c = h(hd, 'div'); h(c, 'div', 'mox-th', a); h(c, 'div', 'mox-ts', b); });
    data.slice().sort((a, b) => a.country.localeCompare(b.country) || a.price - b.price).forEach((d) => {
      const r = h(tab, 'div', 'mox-prow');
      h(r, 'div', 'mox-pt', d.truffle);
      const tr = h(r, 'div', 'mox-ptr'); logo(tr, d.trader, null, 'mox-logo mox-logo-xs'); h(tr, 'span', null, `${d.trader} · ${d.country}`);
      h(r, 'div', 'mox-pp', money(d.price));
      h(r, 'div', 'mox-pa', d.ok ? '✅ available' : '❌ sold out');
    });
  }

  /* ---------- 8. Road map (Gantt) ---------- */
  // | Group | Task | Start | End | Done |
  function renderTimeline(el, rows, today) {
    clear(el); el.classList.add('mox-gantt');
    const P = (s) => { const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
    const items = rows.map((r) => ({ g: r.group, t: r.task, a: P(r.start), b: P(r.end) || P(r.start), done: /yes|✅/i.test(r.done || '') })).filter((x) => x.a);
    if (!items.length) return;
    const lo = new Date(Math.min(...items.map((i) => i.a))); const hi = new Date(Math.max(...items.map((i) => i.b)));
    lo.setDate(1); hi.setMonth(hi.getMonth() + 1, 1);
    const span = hi - lo; const pct = (d) => ((d - lo) / span) * 100;
    h(el, 'div', 'mox-gantt-title', 'Road to the first sale');
    const box = h(el, 'div', 'mox-gantt-box');
    const now = today ? new Date(today + 'T12:00:00') : new Date();
    const line = h(box, 'div', 'mox-gantt-now'); line.style.left = `calc(170px + (100% - 170px) * ${pct(now) / 100})`;
    let lastG = null;
    items.forEach((it) => {
      const row = h(box, 'div', 'mox-grow' + (it.g !== lastG ? ' mox-grow-first' : ''));
      h(row, 'div', 'mox-gname', it.g !== lastG ? it.g : '');
      const lane = h(row, 'div', 'mox-glane');
      const ms = +it.a === +it.b;
      const bar = h(lane, 'div', ms ? 'mox-gms' : 'mox-gbar' + (it.done ? ' mox-gdone' : (it.b < now ? ' mox-glate' : '')));
      bar.style.left = `${pct(it.a)}%`; if (!ms) bar.style.width = `${Math.max(1.2, pct(it.b) - pct(it.a))}%`;
      const lab = h(lane, 'div', 'mox-glabel', it.t + (it.done ? ' ✅' : ''));
      const right = pct(it.b);
      if (right > 72) { lab.style.right = `${100 - pct(it.a) + 0.8}%`; lab.style.textAlign = 'right'; } else lab.style.left = `${right + 0.8}%`;
      lastG = it.g;
    });
    const ax = h(box, 'div', 'mox-gaxis');
    const m = new Date(lo); const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    while (m < hi) { if (m.getMonth() % 3 === 0) { const s = h(ax, 'span', null, `${names[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`); s.style.left = `calc(170px + (100% - 170px) * ${pct(m) / 100})`; } m.setMonth(m.getMonth() + 1); }
  }

  /* ---------- 9. Team ---------- */
  // ID | Name | Role | duties
  function renderTeam(el, source, opts) {
    clear(el); el.classList.add('mox-team');
    const g = h(el, 'div', 'mox-team-g');
    String(source || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r.length >= 3 && r[0]).forEach(([id, name, duties, target]) => {
      const m = target ? link(g, 'mox-member', null, target, opts) : h(g, 'div', 'mox-member');
      h(m, 'div', 'mox-avatar', id); h(m, 'div', 'mox-mn', name); if (duties) h(m, 'div', 'mox-md', duties);
    });
  }

  /* ---------- 10. Docks: My Daily and My Economy ---------- */
  function neon(ctx, w, hh, t) {
    ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, w, hh);
    const S = 6, cols = Math.ceil(w / S), rows = Math.ceil(hh / S);
    const img = ctx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const u = x / cols * 6, v = y / rows * 4;
      const f = Math.sin(u + t * 0.35) + Math.sin(v * 1.3 - t * 0.27) + Math.sin((u + v) * 0.8 + t * 0.21) + Math.sin(Math.hypot(u - 3, v - 2) * 1.6 - t * 0.4);
      const g = Math.exp(-Math.pow(f * 2.2, 2));
      const i = (y * cols + x) * 4; img.data[i] = 40 + 160 * g; img.data[i + 1] = 120 + 135 * g; img.data[i + 2] = 140 + 115 * g; img.data[i + 3] = 255 * Math.min(1, g * 1.2);
    }
    const off = neon.c || (neon.c = document.createElement('canvas')); off.width = cols; off.height = rows; off.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, hh);
  }
  function rain(ctx, w, hh, t) {
    ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, w, hh);
    ctx.font = '12px Menlo, monospace'; const CH = '0123456789$¢€£¥%+−=アイウエオカキ';
    for (let i = 0; i < w / 14; i++) {
      const sp = 30 + (hash('c' + i) % 70); const len = 6 + (hash('l' + i) % 14); const y0 = ((t * sp + hash('o' + i) % 900) % (hh + len * 14)) - len * 14;
      for (let k = 0; k < len; k++) { const a = (k + 1) / len; ctx.fillStyle = k === len - 1 ? `rgba(210,240,255,${0.9})` : `rgba(80,170,230,${0.55 * a})`; ctx.fillText(CH[(hash(i + ':' + k) + ((t * 3) | 0)) % CH.length], i * 14, y0 + k * 14); }
    }
  }
  function dockFrame(el, kind, o) {
    clear(el); el.classList.add('mox-dock', 'mox-dock-' + kind);
    const top = h(el, 'div', 'mox-dock-top');
    const l = h(top, 'div', 'mox-dock-name'); h(l, 'span', 'mox-dock-title', kind === 'daily' ? 'my daily' : 'my economy'); h(l, 'div', 'mox-dock-motto', o.motto || '');
    const mid = h(top, 'div', 'mox-dock-mid'); const right = h(top, 'div', 'mox-dock-right');
    const body = h(el, 'div', 'mox-dock-body');
    const nav = h(body, 'div', 'mox-dock-nav'); h(nav, 'div', 'mox-dock-k', kind === 'daily' ? 'DAILY' : 'ECONOMY');
    const stage = h(body, 'div', 'mox-dock-stage');
    const c = h(stage, 'canvas', 'mox-dock-bg');
    animate(el, c, kind === 'daily' ? neon : rain, kind === 'daily' ? 20 : 14);
    return { mid, right, nav, stage };
  }
  const ICON = {
    today: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    todo: '<path d="M4 7l2 2 4-4M4 17l2 2 4-4M13 7h7M13 17h7"/>', chat: '<path d="M4 18l2-4a8 8 0 1 1 3 3z"/>', gym: '<path d="M3 12h18M6 8v8M18 8v8M3 10v4M21 10v4"/>',
    apple: '<path d="M12 7c-2-2-7-2-7 4 0 5 4 9 7 9s7-4 7-9c0-6-5-6-7-4zM12 7c0-2 1-3 3-4"/>', bars: '<path d="M4 20V10M10 20V4M16 20v-8M3 20h18"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    down: '<path d="M12 4v12M6 11l6 6 6-6M4 20h16"/>', up: '<path d="M12 20V8M6 13l6-6 6 6M4 4h16"/>', check: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l3 3 5-6"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    lines: '<path d="M4 7h16M4 12h16M4 17h10"/>', trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
  };
  const navItem = (nav, icon, text, on) => { const r = h(nav, 'div', 'mox-dock-item' + (on ? ' is-on' : '')); const i = h(r, 'span', 'mox-dock-ic'); i.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</svg>`; h(r, 'span', null, text); return r; };

  // ```mo-daily``` reads the My Daily note: city, motto, a short sample conversation and today's plan.
  function renderDaily(el, text, opts) {
    const o = kv((String(text).match(/```mo-daily\n([\s\S]*?)```/) || [, ''])[1]);
    const f = dockFrame(el, 'daily', { motto: o.motto || 'Do well and think well' });
    const clock = h(f.mid, 'div', 'mox-clock');
    const tick = () => { const d = new Date(); clock.textContent = `${o.city || 'Lucerne'}  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; if (clock.isConnected) setTimeout(tick, 20000); };
    tick();
    h(f.right, 'div', 'mox-temp', o.temp || '+7°C');
    h(f.right, 'div', 'mox-date', new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    [['today', 'Today'], ['mail', 'Mail'], ['todo', 'To Do'], ['chat', 'Personal Assistant', 1], ['gym', 'My Gym'], ['apple', 'My Healthy'], ['bars', 'Progress'], ['gear', 'Settings']].forEach(([i, t, on]) => navItem(f.nav, i, t, on));
    const pa = h(f.stage, 'div', 'mox-panel');
    h(pa, 'div', 'mox-panel-h', 'PERSONAL ASSISTANT');
    const log = h(pa, 'div', 'mox-chat');
    tables(text, 'Sample conversation').forEach((r) => { h(log, 'div', 'mox-msg ' + (/you|me/i.test(r.who) ? 'mox-me' : 'mox-ai'), r.message); });
    const plan = tables(text, 'Today');
    if (plan.length) { const p = h(log, 'div', 'mox-msg mox-ai mox-plan'); h(p, 'div', 'mox-plan-t', 'Today'); plan.forEach((r) => { const l = h(p, 'div', 'mox-plan-r'); h(l, 'b', null, r.time); h(l, 'span', null, r.what); }); }
    const inp = h(pa, 'div', 'mox-input', 'Chat with your Personal Assistant…');
    h(inp, 'span', 'mox-send', '↑');
  }

  // ```mo-economy``` reads the My Economy note tables: Income, Fixed costs, Spending, Savings, Budgets.
  function renderEconomy(el, text, opts) {
    const o = kv((String(text).match(/```mo-economy\n([\s\S]*?)```/) || [, ''])[1]);
    const cur = o.currency || 'CHF';
    const f = dockFrame(el, 'economy', { motto: o.motto || 'Moderation is best' });
    h(f.right, 'div', 'mox-slogan', o.slogan || 'Know where every franc goes');
    [['chat', 'Finance Manager'], ['bars', 'Overview', 1], ['down', 'Income'], ['up', 'Expenses'], ['check', 'Bills'], ['target', 'Savings'], ['lines', 'Debts'], ['trend', 'Model & Plan'], ['folder', 'Documents']].forEach(([i, t, on]) => navItem(f.nav, i, t, on));
    const sum = (rows, key) => rows.reduce((s, r) => s + num(r[key]), 0);
    const inc = sum(tables(text, 'Income'), 'monthly'); const fixed = tables(text, 'Fixed costs'); const spend = tables(text, 'Spending this month');
    const sav = tables(text, 'Savings'); const debts = tables(text, 'Debts');
    const out = sum(fixed, 'monthly') + sum(spend, 'amount'); const save = sum(sav, 'monthly');
    const wrap = h(f.stage, 'div', 'mox-econ');
    const ov = h(wrap, 'div', 'mox-ecard mox-ov');
    const oh = h(ov, 'div', 'mox-ecard-h'); h(oh, 'span', 'mox-ecard-t', 'OVERVIEW'); h(oh, 'span', 'mox-ecard-x', o.cycle || 'cycle: day 18 of 30');
    const og = h(ov, 'div', 'mox-ov-g');
    [[money(inc), 'Income this cycle', 'g'], [money(out), 'Expenses so far', 'r'], [money(inc - out - save), 'Balance (calculated)', 'w'], [money(sum(debts, 'open')), `Debts · ${debts.length} ${debts.length === 1 ? 'item' : 'items'}`, 'y']].forEach(([v, k, c]) => { const d = h(og, 'div', 'mox-ov-c'); h(d, 'div', 'mox-ov-v mox-' + c, v); h(d, 'div', 'mox-ov-k', k); });
    const row = h(wrap, 'div', 'mox-erow');
    const bills = h(row, 'div', 'mox-ecard'); const bh = h(bills, 'div', 'mox-ecard-h'); h(bh, 'span', 'mox-ecard-t', 'BILLS'); h(bh, 'span', 'mox-ecard-x', `${fixed.filter((r) => !/paid|✓/i.test(r.status || '')).length} open`);
    fixed.forEach((r) => { const l = h(bills, 'div', 'mox-bill'); h(l, 'span', 'mox-bill-n', r.what); h(l, 'span', 'mox-bill-v' + (/paid|✓/i.test(r.status || '') ? ' is-paid' : ''), (/paid|✓/i.test(r.status || '') ? '✓ ' : '') + money(num(r.monthly))); });
    const bud = h(row, 'div', 'mox-ecard'); const bdh = h(bud, 'div', 'mox-ecard-h'); h(bdh, 'span', 'mox-ecard-t', 'BUDGETS'); const budgets = tables(text, 'Budgets'); h(bdh, 'span', 'mox-ecard-x', `${budgets.length} active`);
    budgets.forEach((r) => { const used = num(r.used), lim = num(r.limit) || 1; const b = h(bud, 'div', 'mox-budget'); const t = h(b, 'div', 'mox-budget-t'); h(t, 'span', null, r.budget); h(t, 'span', null, `${money(used)} / ${money(lim)}`); const bar = h(b, 'div', 'mox-budget-bar'); const fl = h(bar, 'div', 'mox-budget-fill'); fl.style.width = `${Math.min(100, (used / lim) * 100)}%`; if (used > lim) fl.classList.add('is-over'); });
    h(wrap, 'div', 'mox-ecur', `All amounts in ${cur}. The balance is calculated, never typed by hand.`);
  }

  const api = { tables, kv, logoSVG, renderHeader, renderGoal, renderKnowledge, renderCustomerStats, renderCustomers, renderCompMarquee, renderPrices, renderTimeline, renderTeam, renderDaily, renderEconomy, sectionTitle, customerCounts, competitorLines };
  root.MindOrgShow = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
