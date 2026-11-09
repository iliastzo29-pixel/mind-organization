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
