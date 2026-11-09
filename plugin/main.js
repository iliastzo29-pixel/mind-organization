/* Mind Organization — built file. Edit render.js / setup.js / showcase.js / plugin.js instead. */
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

/*
 * Mind Organization — setup questions.
 * Pure DOM and pure functions, no Obsidian dependency:
 *   renderWizard(el, { onDone, onSkip })  draws the questions step by step
 *   buildVault(answers, today)            returns { 'path.md': 'content', ... }
 *   interviewPrompt(answers)              the deeper interview for a connected AI model
 */
(function (root) {
  const PROJECTS = [
    { id: 'company', label: 'Small company / startup', hint: 'Control Room, decisions, deadlines, customers, competitors, laws' },
    { id: 'freelance', label: 'Freelancer / self-employed', hint: 'Clients, offers, invoices, deadlines' },
    { id: 'personal', label: 'Personal life', hint: 'My Daily (routine, goals) and My Economy (income, expenses, savings)' },
    { id: 'study', label: 'Studies, research or a creative project', hint: 'Sources, books, reading notes, knowledge cards' },
  ];
  const MODELS = ['Not yet', 'Claude', 'DeepSeek', 'Gemini', 'Grok', 'A local model', 'Other'];

  // Each step: id, title, intro, fields. A step with `when` is shown only if that project was chosen.
  const STEPS = [
    { id: 'start', title: 'Welcome to Mind Organization',
      intro: 'A few questions set up your vault. Nothing leaves this computer. You can change everything later, or run these questions again from the command palette.',
      fields: [
        { key: 'name', label: 'Your name', type: 'text', placeholder: 'e.g. Alex Meyer' },
        { key: 'country', label: 'Country you live and work in (laws and taxes are checked for this country)', type: 'text', placeholder: 'e.g. Switzerland' },
        { key: 'projects', label: 'What do you want to organize?', type: 'multi', options: PROJECTS },
        { key: 'model', label: 'Which AI model will you connect?', type: 'select', options: MODELS },
        { key: 'root', label: 'Folder for your vault', type: 'text', value: 'My Mind Organization' },
        { key: 'ticker', label: 'Optional: show a live market ticker on the start page (S&P 500, Nasdaq, Bitcoin, gold). It loads a TradingView widget and needs internet.', type: 'check', value: false },
      ] },
    { id: 'company', when: 'company', title: 'Your company',
      intro: 'The Control Room and the Project Owner are built around these answers.',
      fields: [
        { key: 'company', label: 'Company or project name', type: 'text' },
        { key: 'product', label: 'What do you sell, and to whom?', type: 'area', placeholder: 'e.g. Greek olive oil to restaurants in Zurich' },
        { key: 'stage', label: 'Where are you today?', type: 'select', options: ['Only an idea', 'Preparing the first sale', 'Already selling'] },
        { key: 'legal', label: 'Legal form', type: 'select', options: ['Not decided yet', 'Sole trader', 'Limited company', 'Other'] },
        { key: 'goal', label: 'The one goal for the next six months', type: 'text', placeholder: 'e.g. First legal sale, with all papers in order' },
        { key: 'goalDate', label: 'By when? (DD.MM.YYYY, optional)', type: 'text', placeholder: '31.03.2027' },
      ] },
    { id: 'freelance', when: 'freelance', title: 'Your freelance work',
      fields: [
        { key: 'service', label: 'What service do you offer?', type: 'text' },
        { key: 'clients', label: 'Who pays you? (type of client)', type: 'text' },
        { key: 'pricing', label: 'How do you charge?', type: 'select', options: ['Per hour', 'Per project', 'Monthly retainer', 'Not decided yet'] },
        { key: 'fGoal', label: 'The one goal for the next six months', type: 'text' },
      ] },
    { id: 'personal', when: 'personal', title: 'Your personal life',
      fields: [
        { key: 'daily', label: 'Set up My Daily (today, routine, goals, check-ins)', type: 'check', value: true },
        { key: 'economy', label: 'Set up My Economy (income, expenses, savings, debts)', type: 'check', value: true },
        { key: 'currency', label: 'Currency', type: 'text', value: 'CHF' },
        { key: 'habit', label: 'One habit you want to keep', type: 'text', placeholder: 'e.g. Training three times a week' },
        { key: 'pGoal', label: 'One personal goal for this year', type: 'text' },
      ] },
    { id: 'study', when: 'study', title: 'Your studies, research or creative project',
      fields: [
        { key: 'topic', label: 'Topic or project', type: 'text' },
        { key: 'kind', label: 'What kind?', type: 'select', options: ['Studies', 'Research', 'Creative project'] },
        { key: 'sources', label: 'Your main books or sources (one per line)', type: 'area' },
        { key: 'sDate', label: 'Next important date (exam, hand-in, release), DD.MM.YYYY, optional', type: 'text' },
      ] },
    { id: 'rules', title: 'The rules your agents follow',
      intro: 'These rules are written into Rules.md. Every agent reads them first.',
      fields: [
        { key: 'r1', label: 'Agents prepare, I decide. Nothing is sent, paid or deleted without my approval.', type: 'check', value: true },
        { key: 'r2', label: 'Facts only with a source. Estimates are marked 🟡.', type: 'check', value: true },
        { key: 'r3', label: 'Laws and taxes only from official sources, never from memory.', type: 'check', value: true },
        { key: 'r4', label: 'Every decision, deadline and email is written back into the vault the same day.', type: 'check', value: true },
      ] },
  ];

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const toDate = (t) => (t instanceof Date ? t : t ? new Date(t + 'T12:00:00') : new Date());
  const clean = (s) => String(s || '').trim();
  const safe = (s) => clean(s).replace(/[\\/:*?"<>|#^[\]]/g, '').slice(0, 60) || 'Untitled';
  const has = (a, p) => (a.projects || []).includes(p);
  const lines = (s) => clean(s).split('\n').map((l) => l.trim()).filter(Boolean);
  const okDate = (s) => /^\d{2}\.\d{2}\.\d{4}$/.test(clean(s));

  function visibleSteps(a) { return STEPS.filter((s) => !s.when || has(a, s.when)); }

  // ---------- the wizard ----------
  function renderWizard(el, opts) {
    opts = opts || {};
    const a = { projects: [], model: MODELS[0] };
    STEPS.forEach((s) => s.fields.forEach((f) => { if (f.value !== undefined && a[f.key] === undefined) a[f.key] = f.value; }));
    let i = 0;
    const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

    function draw() {
      const steps = visibleSteps(a);
      const s = steps[i];
      el.innerHTML = '';
      const box = mk('div', 'mo-setup');
      const top = mk('div', 'mo-setup-top');
      top.appendChild(mk('div', 'mo-setup-step', `Step ${i + 1} of ${steps.length}`));
      const bar = mk('div', 'mo-setup-bar'); const fill = mk('div', 'mo-setup-fill');
      fill.style.width = `${Math.round(((i + 1) / steps.length) * 100)}%`; bar.appendChild(fill); top.appendChild(bar);
      box.appendChild(top);
      box.appendChild(mk('h2', 'mo-setup-title', s.title));
      if (s.intro) box.appendChild(mk('p', 'mo-setup-intro', s.intro));

      s.fields.forEach((f) => {
        const row = mk('div', 'mo-setup-field');
        if (f.type === 'check') {
          const lab = mk('label', 'mo-setup-check'); const cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!a[f.key];
          cb.onchange = () => { a[f.key] = cb.checked; };
          lab.appendChild(cb); lab.appendChild(mk('span', null, f.label)); row.appendChild(lab);
        } else {
          row.appendChild(mk('div', 'mo-setup-label', f.label));
          if (f.type === 'multi') {
            const grid = mk('div', 'mo-setup-cards');
            f.options.forEach((o) => {
              const card = mk('label', 'mo-setup-card' + (has(a, o.id) ? ' is-on' : ''));
              const cb = mk('input'); cb.type = 'checkbox'; cb.checked = has(a, o.id);
              cb.onchange = () => {
                a.projects = cb.checked ? a.projects.concat(o.id) : a.projects.filter((p) => p !== o.id);
                card.classList.toggle('is-on', cb.checked);
              };
              card.appendChild(cb); card.appendChild(mk('div', 'mo-setup-card-t', o.label)); card.appendChild(mk('div', 'mo-setup-card-h', o.hint));
              grid.appendChild(card);
            });
            row.appendChild(grid);
          } else if (f.type === 'select') {
            const sel = mk('select', 'mo-setup-input');
            f.options.forEach((o) => { const op = mk('option', null, o); op.value = o; sel.appendChild(op); });
            sel.value = a[f.key] || f.options[0]; a[f.key] = sel.value;
            sel.onchange = () => { a[f.key] = sel.value; };
            row.appendChild(sel);
          } else {
            const inp = mk(f.type === 'area' ? 'textarea' : 'input', 'mo-setup-input');
            if (f.type !== 'area') inp.type = 'text';
            inp.placeholder = f.placeholder || ''; inp.value = a[f.key] || '';
            inp.oninput = () => { a[f.key] = inp.value; };
            row.appendChild(inp);
          }
        }
        box.appendChild(row);
      });

      const msg = mk('div', 'mo-setup-msg'); box.appendChild(msg);
      const nav = mk('div', 'mo-setup-nav');
      if (i === 0) {
        const skip = mk('button', 'mo-setup-btn ghost', 'Just explore the demo');
        skip.onclick = () => opts.onSkip && opts.onSkip(); nav.appendChild(skip);
      } else {
        const back = mk('button', 'mo-setup-btn ghost', 'Back'); back.onclick = () => { i -= 1; draw(); }; nav.appendChild(back);
      }
      const last = i === steps.length - 1;
      const next = mk('button', 'mo-setup-btn', last ? 'Create my vault' : 'Next');
      next.onclick = () => {
        if (s.id === 'start' && !(a.projects || []).length) { msg.textContent = 'Choose at least one thing to organize.'; return; }
        if (s.id === 'start' && !clean(a.name)) { msg.textContent = 'Please write your name. It goes into the Decision Log as the person who approves.'; return; }
        if (last) { opts.onDone && opts.onDone(Object.assign({}, a)); return; }
        i += 1; draw();
      };
      nav.appendChild(next);
      box.appendChild(nav);
      el.appendChild(box);
    }
    draw();
    return { answers: a, go: (n) => { i = n; draw(); } };
  }

  // ---------- the deeper interview for a connected model ----------
  const DEEP = {
    company: [
      'Which legal form fits best, and what does registration need in your country (register, tax number, social insurance)?',
      'Which official authorities decide for your product (for example food safety, customs, licences)? Name each one and its official website.',
      'Which laws apply to what you sell? For each: the official source, the article, and what it means for you.',
      'Taxes: from which turnover is VAT due, and what must be filed when?',
      'Insurance: which insurance is required, which is only recommended?',
      'Suppliers: who are they, what is agreed, what is still open?',
      'Customers: who exactly, how many, where, and who decides the purchase?',
      'Competitors: who sells something similar, at what price, and what makes you different?',
      'Price: what does it cost you, what will you charge, and on which source is the price based?',
      'What must be true before the first sale? Write each item as a deadline.',
      'Which decisions have you already taken? Write each one as a Decision Log entry with its reason.',
      'Which books or official guides should the strategy and marketing managers use as their only sources?',
    ],
    freelance: [
      'Do you need to register as self-employed, and with which office?',
      'From which income do VAT and social insurance apply?',
      'What does a standard offer and contract contain? What are your payment terms?',
      'How do you invoice, and how do you track unpaid invoices?',
      'Which clients do you want more of, and where do you find them?',
      'Which decisions about price and clients have you already taken?',
    ],
    personal: [
      'My Daily: what does a good day look like for you, hour by hour?',
      'Which routines (training, sleep, learning) should the Personal Assistant check, and how often?',
      'Which goals for this year, and how do we measure progress?',
      'My Economy: which fixed income, which fixed costs, which categories for other spending?',
      'How much do you want to save each month, and for what?',
      'Do you have debts or instalments to track? (Amounts stay in your own data files.)',
    ],
    study: [
      'What is the exact question your work answers?',
      'Which sources are allowed, and which are not? List the books, papers or official documents.',
      'How should reading notes look (page numbers, quotes, your own conclusions marked separately)?',
      'Which dates matter (exams, hand-ins, releases)? Write each as a deadline.',
      'Who gives feedback, and how is it recorded?',
    ],
  };

  function interviewPrompt(a) {
    const chosen = PROJECTS.filter((p) => has(a, p.id));
    const R = safe(a.root || 'My Mind Organization');
    const out = [];
    out.push('# AI interview: finish setting up my vault', '');
    out.push('Give this note to your AI model (' + (a.model && a.model !== 'Not yet' ? a.model : 'Claude, DeepSeek, Gemini, Grok or a local model') + ') once it is connected.');
    out.push('If the model can read this vault, paste only this note. If it cannot, paste this note together with `Setup/Answers.md` and `Rules.md`, and copy its answers back into the notes yourself.', '');
    out.push('---', '');
    out.push(`You are the setup interviewer for my Mind Organization vault. My name is ${clean(a.name)}. I live and work in ${clean(a.country) || 'my country'}.`);
    out.push(`My vault is in the folder \`${R}\`. Read \`${R}/Setup/Answers.md\` and \`${R}/Rules.md\` first.`);
    out.push('Then ask me the questions below, one at a time, in the order given. Wait for my answer before the next question.');
    out.push('Rules while you do this:');
    out.push('- Never invent facts. If something needs a law or an official source, tell me which official website to check, and mark anything unconfirmed with 🟡.');
    out.push('- After each topic, show me exactly what you will write into which note, and write it only after I say yes.');
    out.push(`- Decisions go into \`${R}/Decision Log.md\`, dates into \`${R}/Deadlines.md\`, sources into \`${R}/Handbook/Handbook.md\`, and a short entry into \`${R}/Journal.md\`.`);
    out.push('');
    chosen.forEach((p) => {
      out.push(`## ${p.label}`);
      DEEP[p.id].forEach((q, n) => out.push(`${n + 1}. ${q}`));
      out.push('');
    });
    out.push('## At the end', `1. Write a one-page summary of my vault into \`${R}/Control Room.md\`, under the live blocks.`, '2. List what is still open as deadlines.', '3. Tell me which recurring jobs (price checks, law-page checks, reminders) should run on a local agent instead of in the chat.');
    return out.join('\n');
  }

  // ---------- the vault ----------
  function buildVault(a, today) {
    const t = toDate(today);
    const R = safe(a.root || 'My Mind Organization');
    const P = (p) => `${R}/${p}`;
    const name = clean(a.name) || 'Owner';
    const files = {};
    const cur = clean(a.currency) || 'CHF';
    const country = clean(a.country) || 'your country';
    const company = has(a, 'company') ? safe(a.company || 'My Company') : null;

    // Deadlines
    const dl = [[fmt(addDays(t, 7)), 'Connect an AI model and run Setup/AI Interview', name]];
    if (company && okDate(a.goalDate)) dl.push([clean(a.goalDate), clean(a.goal) || 'Company goal', name]);
    else if (company && clean(a.goal)) dl.push([fmt(addDays(t, 30)), `Set a date for: ${clean(a.goal)}`, name]);
    if (has(a, 'study') && okDate(a.sDate)) dl.push([clean(a.sDate), `${clean(a.kind) || 'Study'}: ${clean(a.topic) || 'next date'}`, name]);
    if (has(a, 'freelance')) dl.push([fmt(addDays(t, 14)), 'Write a standard offer and payment terms', name]);
    if (has(a, 'personal') && a.economy) dl.push([fmt(addDays(t, 30)), 'First monthly review in My Economy', name]);
    files[P('Deadlines.md')] = [
      '# ⏰ Deadlines', '', 'One row per deadline. The Control Room calculates what is overdue and what is due this week.', '',
      '| When | What | Who |', '|---|---|---|',
      ...dl.map((r) => `| **${r[0]}** | ${r[1]} | ${r[2]} |`), '',
      '## Waiting for an answer', '', '| Since | From whom | About what |', '|---|---|---|', '',
    ].join('\n');

    // Decision Log
    const decs = [
      ['DEC-SET-002', 'Agents prepare, I decide', 'Nothing is sent, paid or deleted without my explicit approval.', 'So that every action in my name is one I chose.'],
      ['DEC-SET-001', 'Run my work and life from this vault', 'Decisions, deadlines, sources and notes live in plain Markdown notes in this vault.', 'One place, one source of truth.'],
    ];
    files[P('Decision Log.md')] = ['# 📒 Decision Log', '', 'Newest first. One heading per decision.', '',
      ...decs.flatMap((d) => [`### ${d[0]} · ${d[1]}`, `- **Decision:** ${d[2]}`, `- **Reason:** ${d[3]}`, `- **Approved:** ${name}, ${fmt(t)}`, '']),
    ].join('\n');

    // Rules
    const rules = [];
    if (a.r1 !== false) rules.push('Agents prepare, I decide. Nothing is sent, paid or deleted without my explicit approval.');
    if (a.r2 !== false) rules.push('Facts only with a source. Estimates are marked 🟡, unknowns ❓, conflicts ⚠️.');
    if (a.r3 !== false) rules.push(`Laws and taxes only from official sources for ${country}, never from memory. If a source is missing, add it to the Handbook first.`);
    if (a.r4 !== false) rules.push('Every decision, deadline and email is written back into the vault the same day.');
    rules.push('No passwords, card or account numbers in the vault.', 'Recurring jobs run on a local agent, not in the chat.');
    files[P('Rules.md')] = ['# 📏 Rules', '', 'Every agent reads this page first.', '', ...rules.map((r, n) => `${n + 1}. ${r}`), ''].join('\n');

    // Journal
    files[P('Journal.md')] = ['# 📓 Journal', '', 'Short entries, newest on top.', '', `### ${fmt(t)} · Vault created`,
      `- Set up with the Mind Organization questions: ${PROJECTS.filter((p) => has(a, p.id)).map((p) => p.label).join(', ')}.`,
      '- Next: connect an AI model and run [[Setup/AI Interview]].', ''].join('\n');

    // Handbook
    const hb = ['# 📚 Handbook', '', 'The only sources the agents may use for laws, taxes and facts. One line per source: name, official link, date checked.', '',
      '| Topic | Source | Link | Checked |', '|---|---|---|---|',
      `| Laws | Official law portal of ${country} | ❓ add link | |`,
      `| Taxes | Official tax authority of ${country} | ❓ add link | |`];
    if (has(a, 'study')) lines(a.sources).forEach((s) => hb.push(`| ${clean(a.topic) || 'Study'} | ${s} | | |`));
    files[P('Handbook/Handbook.md')] = hb.concat('').join('\n');

    // Agents
    const homes = [];
    const po = ['# 🧭 Project Owner', '', `Coordinates everything for ${name}.`, '', '## At the start of every session', '1. Read [[Rules]], [[Control Room]], [[Decision Log]] and [[Deadlines]].', '2. Read the newest entries in [[Journal]].', '',
      '## How it works', '- Researches with sources from the [[Handbook/Handbook|Handbook]] only.', '- Drafts emails and texts; shows them for approval; never sends on its own.', '- Writes every outcome back into the vault the same day.', ''];
    files[P('Agents/Project Owner.md')] = po.join('\n');

    if (company) {
      homes.push(`[[${company}/${company}|${company}]]`);
      files[P(`${company}/${company}.md`)] = [`# 🏢 ${company}`, '', `**What we sell:** ${clean(a.product) || '❓'}`, `**Stage:** ${clean(a.stage) || '❓'}`, `**Legal form:** ${clean(a.legal) || '❓'}`,
        `**Goal (next six months):** ${clean(a.goal) || '❓'}${okDate(a.goalDate) ? ` · by ${clean(a.goalDate)}` : ''}`, '', '## Pages', `- [[${company}/Customers|Customers]]`, `- [[${company}/Competitors|Competitors]]`, '- [[Agents/Business Strategy Manager|Business Strategy Manager]] · [[Agents/Marketing Manager|Marketing Manager]]', ''].join('\n');
      files[P(`${company}/Customers.md`)] = ['# 🤝 Customers', '', '| Name | Type | Place | Contact | Status | Last contact |', '|---|---|---|---|---|---|', ''].join('\n');
      files[P(`${company}/Competitors.md`)] = ['# 🔎 Competitors', '', 'One line per competitor: `Name | website | country`. The plugin draws the tiles.', '', '```mo-competitors', '```', ''].join('\n');
      files[P('Agents/Business Strategy Manager.md')] = ['# Business Strategy Manager', '', 'Law, cost, risk and numbers.', '', '- Works only from the [[Handbook/Handbook|Handbook]] and the strategy books listed there.', '- Checks every idea against the [[Decision Log]] first.', '- Answers: what it rests on, what it costs, what the risk is, what is missing.', ''].join('\n');
      files[P('Agents/Marketing Manager.md')] = ['# Marketing Manager', '', 'Customers, brand and every promise we make.', '', '- Works only from the marketing books in the [[Handbook/Handbook|Handbook]] and our own customer conversations.', '- Never promises what the company cannot deliver yet.', ''].join('\n');
    }
    if (has(a, 'freelance')) {
      homes.push('[[Freelance/Clients|Clients]]');
      files[P('Freelance/Clients.md')] = ['# 👥 Clients', '', `**Service:** ${clean(a.service) || '❓'} · **Clients:** ${clean(a.clients) || '❓'} · **Pricing:** ${clean(a.pricing) || '❓'}`, `**Goal:** ${clean(a.fGoal) || '❓'}`, '', '| Client | Project | Offer sent | Status | Invoice | Paid |', '|---|---|---|---|---|---|', ''].join('\n');
      files[P('Freelance/Offers.md')] = ['# 📄 Offers', '', 'One section per offer: client, scope, price, payment terms, status.', ''].join('\n');
    }
    if (has(a, 'personal') && a.daily) {
      homes.push('[[My Daily/My Daily|My Daily]]');
      files[P('My Daily/My Daily.md')] = ['# ☀️ My Daily', '', '```mo-next', P('Deadlines.md'), '```', '', `**Habit:** ${clean(a.habit) || '❓'}`, `**Goal this year:** ${clean(a.pGoal) || '❓'}`, '', '## Check-ins', '| Date | Habit done | Note |', '|---|---|---|', ''].join('\n');
      files[P('Agents/Personal Assistant.md')] = ['# Personal Assistant', '', 'Keeps the day, the routine and the goals in [[My Daily/My Daily|My Daily]].', '', '- Asks once a day about the habit and writes the answer into the check-ins.', '- Shows progress, never judges.', ''].join('\n');
    }
    if (has(a, 'personal') && a.economy) {
      homes.push('[[My Economy/My Economy|My Economy]]');
      files[P('My Economy/My Economy.md')] = ['# 💰 My Economy', '', `All amounts in ${cur}. The balance is calculated, never typed by hand.`, '',
        '## Income', '| Source | Monthly |', '|---|---|', '', '## Fixed costs', '| What | Monthly |', '|---|---|', '', '## Other spending this month', '| Date | What | Category | Amount |', '|---|---|---|---|', '',
        '## Savings', '| Goal | Monthly | Saved so far |', '|---|---|---|', '', '## Monthly reviews', '', ''].join('\n');
      files[P('Agents/Finance Manager.md')] = ['# Finance Manager', '', 'Keeps [[My Economy/My Economy|My Economy]] in order.', '', `- Balance = income − fixed costs − other spending − savings (${cur}).`, '- Never stores passwords, card or account numbers.', '- Once a month: a short review with what changed and what to watch.', ''].join('\n');
    }
    if (has(a, 'study')) {
      const topic = safe(a.topic || 'My Study');
      homes.push(`[[Study/${topic}|${topic}]]`);
      files[P(`Study/${topic}.md`)] = [`# 🎓 ${topic}`, '', `**Kind:** ${clean(a.kind) || '❓'}${okDate(a.sDate) ? ` · next date ${clean(a.sDate)}` : ''}`, '', '## Sources', ...(lines(a.sources).length ? lines(a.sources).map((s) => `- ${s}`) : ['- ❓ add your books and sources']), '',
        '## Reading notes', '- One note per source in `Study/Reading notes/`: page, quote, and your own conclusion marked separately.', ''].join('\n');
      files[P('Study/Reading notes/Template.md')] = ['# Reading notes · (source)', '', '| Page | What the source says | What it means for my work 🟡 |', '|---|---|---|', ''].join('\n');
      files[P('Agents/Research Assistant.md')] = ['# Research Assistant', '', `Helps with ${topic}.`, '', '- Uses only the sources listed in the topic note and the Handbook.', '- Quotes with page numbers; marks its own reading 🟡.', ''].join('\n');
    }

    // Control Room
    files[P('Control Room.md')] = ['# 🎛 Control Room', '', `${name} · ${country}`, '', '```mo-next', `${R}/Deadlines.md`, '```', '', '```mo-decisions', `${R}/Decision Log.md`, 'limit: 4', '```', '',
      '## My areas', ...homes.map((h) => `- ${h}`), '', '## Always', '- [[Rules]] · [[Journal]] · [[Handbook/Handbook|Handbook]] · [[Agents/Project Owner|Project Owner]]',
      '- Next step: [[Setup/AI Interview]]', ''].join('\n');

    // Setup record + interview
    const ans = ['# Setup answers', '', `Created ${fmt(t)} with the Mind Organization questions.`, ''];
    visibleSteps(a).forEach((s) => {
      ans.push(`## ${s.title}`);
      s.fields.forEach((f) => {
        let v = a[f.key];
        if (f.key === 'projects') v = PROJECTS.filter((p) => has(a, p.id)).map((p) => p.label).join(', ');
        if (typeof v === 'boolean') v = v ? 'yes' : 'no';
        ans.push(`- **${f.label}:** ${clean(v) || '—'}`);
      });
      ans.push('');
    });
    files[P('Setup/Answers.md')] = ans.join('\n');
    files[P('Setup/AI Interview.md')] = interviewPrompt(a);

    // Make every wiki link point inside the new folder, so it never clashes with notes that already exist.
    Object.keys(files).forEach((k) => {
      files[k] = files[k].replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (m, target, alias) => {
        if (target.startsWith(R + '/')) return m;
        const label = alias ? alias.slice(1) : target.split('/').pop();
        return `[[${R}/${target}|${label}]]`;
      });
    });
    return files;
  }

  const api = { PROJECTS, STEPS, renderWizard, buildVault, interviewPrompt };
  root.MindOrgSetup = api;
  if (typeof module !== 'undefined' && module.exports && !root.__moBundled) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

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

  // ```mo-chat``` draws the Project Owner chat panel of the Control Room.
  // Lines "title: …", "sub: …", "placeholder: …"; every other "Name: text" line is one message
  // ("You:" on the right, everyone else on the left). In the demo it is a sample conversation.
  function renderChat(el, source) {
    const lines = String(source || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const o = {}; const msgs = [];
    for (const l of lines) {
      const m = l.match(/^([^:]+):\s*(.*)$/); if (!m) continue;
      const k = m[1].trim(); const v = m[2].trim();
      if (/^(title|sub|placeholder)$/i.test(k)) o[k.toLowerCase()] = v; else msgs.push({ who: k, text: v });
    }
    const pa = h(el, 'div', 'mox-panel mox-po');
    const head = h(pa, 'div', 'mox-panel-h');
    h(head, 'span', null, (o.title || 'Project Owner').toUpperCase());
    if (o.sub !== '') h(head, 'span', 'mox-panel-sub', '· ' + (o.sub || 'your coordinator'));
    const log = h(pa, 'div', 'mox-chat');
    msgs.forEach((r) => { h(log, 'div', 'mox-msg ' + (/^(you|me)$/i.test(r.who) ? 'mox-me' : 'mox-ai'), r.text); });
    const inp = h(pa, 'div', 'mox-input', o.placeholder || 'Ask your Project Owner…');
    h(inp, 'span', 'mox-send', '↑');
  }

  const api = { tables, kv, logoSVG, renderHeader, renderGoal, renderKnowledge, renderCustomerStats, renderCustomers, renderCompMarquee, renderPrices, renderTimeline, renderTeam, renderDaily, renderEconomy, renderChat, sectionTitle, customerCounts, competitorLines };
  root.MindOrgShow = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Mind Organization — Obsidian plugin entry.
 * Registers the live blocks and the setup questions. render.js and setup.js
 * are inlined above this file by build.sh, so Obsidian loads a single main.js.
 */
const { Plugin, Notice, Modal, ItemView, normalizePath } = require('obsidian');

const VIEW_START = 'mind-organization-start';

// The start page: a brain drawn in WebGL and six circles that open the areas of the vault.
class StartView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_START; }
  getDisplayText() { return 'Mind Organization'; }
  getIcon() { return 'brain-circuit'; }
  async onOpen() {
    const data = (await this.plugin.loadData()) || {};
    const el = this.containerEl.children[1]; el.empty(); el.addClass('mo-start');
    const src = this.app.vault.adapter.getResourcePath(`${this.plugin.manifest.dir}/assets/landing.html`);
    const hash = `#vault=${encodeURIComponent(this.app.vault.getName())}&name=${encodeURIComponent(data.name || 'Mind Organization')}${data.ticker ? '&ticker=1' : ''}`;
    el.createEl('iframe', { cls: 'mo-start-frame', attr: { src: src + hash, allow: 'autoplay' } });
  }
  async onClose() { this.containerEl.children[1].empty(); }
}

class SetupModal extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    this.modalEl.addClass('mo-setup-modal');
    MindOrgSetup.renderWizard(this.contentEl, {
      onSkip: async () => { await this.plugin.markSetup({ skipped: true }); this.close(); },
      onDone: async (answers) => { this.close(); await this.plugin.createVault(answers); },
    });
  }
  onClose() { this.contentEl.empty(); }
}

const DEFAULTS = {
  deadlines: 'Deadlines.md',
  decisions: 'Decision Log.md',
};

// The first non-empty line of a block may name another note: ```mo-next\nOther page.md\n```
const firstLine = (src) => String(src || '').split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';

module.exports = class MindOrganization extends Plugin {
  // Showcase blocks: the same look as the author's vault, with data from plain notes.
  registerShowcase(read) {
    const S = MindOrgShow;
    const asset = (f) => this.app.vault.adapter.getResourcePath(`${this.manifest.dir}/assets/${f}`);
    const block = (name, fn, watch) => {
      this.registerMarkdownCodeBlockProcessor(name, async (source, el, ctx) => {
        const opts = { open: (t) => t && this.app.workspace.openLinkText(t, ctx.sourcePath || ''), button: true };
        const run = async () => { try { await fn(source, el, ctx, opts); } catch (e) { el.setText(`Mind Organization: ${name} failed (${e.message})`); } };
        await run();
        const files = watch ? watch(source, ctx) : [];
        if (files.length) this.registerEvent(this.app.vault.on('modify', (f) => { if (files.includes(f.path) && el.isConnected) run(); }));
      });
    };
    const first = (src, fallback) => { const l = String(src || '').split('\n').map((x) => x.trim()).find((x) => /\.md$/i.test(x)); return l || fallback; };
    block('mo-header', (src, el) => S.renderHeader(el, src, { video: /^\s*waves\s*:\s*video/mi.test(src) ? asset('wave.mp4') : null }));
    block('mo-goal', (src, el) => S.renderGoal(el, src));
    block('mo-knowledge', async (src, el, ctx, opts) => {
      const hb = await read('Handbook.md'); const dl = await read('Deadlines.md');
      const items = MindOrg.parseDeadlines(dl);
      S.renderKnowledge(el, Object.assign(opts, {
        head: asset('knowledge-head.svg'),
        counts: {
          facts: S.tables(hb, 'Facts').length,
          decisions: MindOrg.parseDecisions(await read('Decision Log.md')).length,
          open: (await read('Open Questions.md')).split('\n').filter((l) => /^\s*[-*] /.test(l)).length,
          sources: S.tables(hb, 'Sources').length,
          critical: items.filter((i) => i.state === 'late' || i.state === 'soon').length,
        },
        links: { title: 'Handbook', facts: 'Handbook', decisions: 'Decision Log', open: 'Open Questions', sources: 'Handbook', critical: 'Deadlines' },
      }));
    }, () => ['Handbook.md', 'Deadlines.md', 'Decision Log.md', 'Open Questions.md']);
    block('mo-customers-stats', async (src, el, ctx, opts) => S.renderCustomerStats(el, S.tables(await read(first(src, 'Customers.md'))), opts), (src) => [first(src, 'Customers.md')]);
    block('mo-customers', async (src, el, ctx, opts) => {
      const lists = String(src || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0] && r.length >= 2).map(([title, sub, target]) => ({ title, sub, target }));
      S.renderCustomers(el, S.tables(await read('Customers.md')), lists, opts);
    }, () => ['Customers.md']);
    const compSource = async () => ((await read('Competitors.md')).match(/```mo-competitors\n([\s\S]*?)```/) || [, ''])[1];
    block('mo-comp-marquee', async (src, el, ctx, opts) => S.renderCompMarquee(el, await compSource(), opts), () => ['Competitors.md']);
    block('mo-prices', async (src, el, ctx) => S.renderPrices(el, S.tables(await read(first(src, ctx.sourcePath)), 'Prices')), (src, ctx) => [first(src, ctx.sourcePath)]);
    block('mo-timeline', async (src, el) => S.renderTimeline(el, S.tables(await read(first(src, 'Road map.md')))), (src) => [first(src, 'Road map.md')]);
    block('mo-team', (src, el, ctx, opts) => S.renderTeam(el, src, opts));
    block('mo-chat', (src, el) => S.renderChat(el, src));
    block('mo-daily', async (src, el, ctx, opts) => S.renderDaily(el, await read(ctx.sourcePath), opts), (src, ctx) => [ctx.sourcePath]);
    block('mo-economy', async (src, el, ctx, opts) => S.renderEconomy(el, await read(ctx.sourcePath), opts), (src, ctx) => [ctx.sourcePath]);
  }

  async markSetup(extra) {
    const data = Object.assign({}, (await this.loadData()) || {}, { setupDone: true }, extra || {});
    await this.saveData(data);
  }

  // Writes the new notes. Existing notes are never overwritten.
  async createVault(answers) {
    const files = MindOrgSetup.buildVault(answers, new Date());
    const adapter = this.app.vault.adapter;
    let made = 0, kept = 0;
    for (const [raw, content] of Object.entries(files)) {
      const path = normalizePath(raw);
      const parts = path.split('/'); parts.pop();
      let dir = '';
      for (const part of parts) {
        dir = dir ? `${dir}/${part}` : part;
        if (!(await adapter.exists(dir))) await this.app.vault.createFolder(dir);
      }
      if (await adapter.exists(path)) { kept += 1; continue; }
      await this.app.vault.create(path, content);
      made += 1;
    }
    await this.markSetup({ root: answers.root, projects: answers.projects, name: answers.name, ticker: !!answers.ticker, createdAt: new Date().toISOString() });
    new Notice(`Mind Organization: ${made} notes created${kept ? `, ${kept} existing notes left unchanged` : ''}.`, 8000);
    const start = normalizePath(`${(answers.root || 'My Mind Organization').trim()}/Control Room.md`);
    this.app.workspace.openLinkText(start, '', false);
  }

  async openStart() {
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_START, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async onload() {
    this.addCommand({ id: 'run-setup', name: 'Run the setup questions', callback: () => new SetupModal(this.app, this).open() });
    this.registerView(VIEW_START, (leaf) => new StartView(leaf, this));
    this.addCommand({ id: 'open-start', name: 'Open the start page', callback: () => this.openStart() });
    this.addRibbonIcon('brain-circuit', 'Mind Organization: start page', () => this.openStart());
    this.addCommand({ id: 'toggle-ticker', name: 'Turn the live market ticker on or off', callback: async () => {
      const data = (await this.loadData()) || {}; data.ticker = !data.ticker; await this.saveData(data);
      new Notice(data.ticker ? 'Market ticker on. It loads a TradingView widget and needs internet.' : 'Market ticker off.');
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_START)) await leaf.view.onOpen();
    } });

    const read = async (path) => {
      try { return await this.app.vault.adapter.read(path); } catch (e) { return ''; }
    };
    this.registerShowcase(read);

    const live = (name, fallback, render, optsFromSource) => {
      this.registerMarkdownCodeBlockProcessor(name, async (source, el) => {
        const line = firstLine(source);
        const path = /\.md$/i.test(line) ? line : fallback;
        const opts = optsFromSource ? optsFromSource(source) : {};
        render(el, await read(path), opts);
        // Re-render when the source note changes, so the block is always current.
        this.registerEvent(this.app.vault.on('modify', async (f) => {
          if (f.path === path && el.isConnected) render(el, await read(path), opts);
        }));
      });
    };

    live('mo-deadlines', DEFAULTS.deadlines, MindOrg.renderDeadlines);
    live('mo-next', DEFAULTS.deadlines, MindOrg.renderNext);
    live('mo-decisions', DEFAULTS.decisions, MindOrg.renderDecisions, (src) => {
      const n = parseInt(String(src).match(/limit:\s*(\d+)/i)?.[1] || '4', 10);
      return { limit: n };
    });

    this.registerMarkdownCodeBlockProcessor('mo-competitors', (source, el) => {
      MindOrg.renderCompetitors(el, source);
    });

    // Once a day, on start: a short notice if something is overdue or due this week.
    this.app.workspace.onLayoutReady(async () => {
      const data = (await this.loadData()) || {};
      if (data.openStart !== false && !this.app.workspace.getLeavesOfType(VIEW_START).length) await this.openStart();
      if (!data.setupDone) new SetupModal(this.app, this).open();
      const items = MindOrg.parseDeadlines(await read(data.root ? normalizePath(`${data.root}/Deadlines.md`) : DEFAULTS.deadlines));
      const late = items.filter((i) => i.state === 'late');
      const soon = items.filter((i) => i.state === 'soon');
      if (!late.length && !soon.length) return;
      const parts = [];
      if (late.length) parts.push(`🔴 ${late.length} overdue: ${late.map((i) => i.what).join(' · ')}`);
      if (soon.length) parts.push(`🟠 this week: ${soon.map((i) => i.what).join(' · ')}`);
      new Notice('⏰ Deadlines\n' + parts.join('\n'), 12000);
    });
  }
};
