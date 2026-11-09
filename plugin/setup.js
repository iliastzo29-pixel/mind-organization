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
