'use strict';
const { loadNetwork } = require('./network-data');

joplin.plugins.register({
  onStart: async function() {
    // SettingItemType.Int = 1 and Bool = 3 in Joplin's plugin API.
    await joplin.settings.registerSettings({
      tagLimit: { value: 0, type: 1, public: false },
      hideDisconnected: { value: false, type: 3, public: false },
      showDots: { value: true, type: 3, public: false },
      showNames: { value: true, type: 3, public: false },
      fontScale: { value: 100, type: 1, public: false },
    });
    const panel = await joplin.views.panels.create('tagNetwork.panel');
    let network = null, loadedAt = 0, pending = null, rerun = false;
    const send = message => joplin.views.panels.postMessage(panel, message);
    async function refresh() {
      if (pending) { rerun = true; return pending; }
      pending = (async () => {
        do {
          rerun = false;
          send({ type: 'loading', hasData: network !== null });
          try {
            network = await loadNetwork(joplin.data, (done, total) => {
              if (!done || done === total || done % 25 === 0) send({ type: 'progress', done, total });
            });
            loadedAt = Date.now();
            send({ type: 'network', network });
          } catch (error) {
            console.error('Tag Network: could not load tags', error);
            send({ type: 'error', hasData: network !== null });
          }
        } while (rerun);
      })();
      try { await pending; } finally { pending = null; }
    }
    await joplin.views.panels.setHtml(panel, `
      <main class="app">
        <header><h1>Tag network</h1><button id="refresh" title="Refresh network" aria-label="Refresh network">↻</button></header>
        <div class="controls">
          <label for="limit">Tags</label><select id="limit"><option value="0">All tags</option><option value="custom">Most used</option></select>
          <input id="count" type="number" min="1" step="1" value="100" aria-label="Number of most-used tags">
          <label class="check"><input id="hide" type="checkbox"> Hide disconnected</label>
          <label class="check"><input id="show-dots" type="checkbox" checked> Show dots</label>
          <label class="check"><input id="show-names" type="checkbox" checked> Show tag names</label>
        </div>
        <div class="text-size"><label for="font-scale">Tag text size</label><input id="font-scale" type="range" min="50" max="200" step="10" value="100"><output id="font-scale-value" for="font-scale">100%</output></div>
        <div class="toolbar"><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><button id="fit" title="Fit graph to panel">Fit</button><span>Scroll to zoom · drag to move</span></div>
        <div id="legend" class="legend"><span>Dot color: fewer notes</span><span class="gradient" aria-hidden="true"></span><span>more notes</span></div>
        <p id="status" role="status" aria-live="polite">Loading tags…</p>
        <div id="viewport"><canvas id="graph" aria-label="Tag network graph"></canvas><div id="tooltip" role="tooltip" hidden></div></div>
        <details><summary>Browse displayed tags</summary><div id="tag-list"></div></details>
      </main>`);
    await joplin.views.panels.onMessage(panel, async message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') {
        const values = await joplin.settings.values(['tagLimit', 'hideDisconnected', 'showDots', 'showNames', 'fontScale']);
        send({ type: 'settings', ...values });
        if (network) send({ type: 'network', network });
        else if (pending) send({ type: 'loading', hasData: false });
        else void refresh();
      } else if (message.type === 'refresh') await refresh();
      else if (message.type === 'settings') {
        if (Number.isSafeInteger(message.tagLimit) && message.tagLimit >= 0) await joplin.settings.setValue('tagLimit', message.tagLimit);
        if (typeof message.hideDisconnected === 'boolean') await joplin.settings.setValue('hideDisconnected', message.hideDisconnected);
        if (typeof message.showDots === 'boolean') await joplin.settings.setValue('showDots', message.showDots);
        if (typeof message.showNames === 'boolean') await joplin.settings.setValue('showNames', message.showNames);
        if (Number.isInteger(message.fontScale) && message.fontScale >= 50 && message.fontScale <= 200) await joplin.settings.setValue('fontScale', message.fontScale);
      } else if (message.type === 'openTag' && typeof message.id === 'string' && network && network.nodes.some(n => n.id === message.id)) {
        await joplin.commands.execute('openTag', message.id);
      }
    });
    await joplin.views.panels.addScript(panel, './network.css');
    await joplin.views.panels.addScript(panel, './layout.js');
    await joplin.views.panels.addScript(panel, './webview.js');
    await joplin.commands.register({ name: 'toggleTagNetwork', label: 'Toggle Tag Network', execute: async () => {
      const visible = await joplin.views.panels.visible(panel);
      await joplin.views.panels.show(panel, !visible);
      if (!visible && Date.now() - loadedAt > 30000) void refresh();
    }});
    await joplin.views.menuItems.create('toggleTagNetworkMenu', 'toggleTagNetwork', 'view');
    await joplin.workspace.onSyncComplete(() => { void refresh(); });
    await joplin.workspace.onNoteSelectionChange(async () => {
      if (network && Date.now() - loadedAt > 30000 && await joplin.views.panels.visible(panel)) void refresh();
    });
  },
});
