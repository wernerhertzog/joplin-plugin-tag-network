'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('graph'), ctx = canvas.getContext('2d'), viewport = $('viewport');
  const tip = $('tooltip'), status = $('status'), limit = $('limit'), count = $('count'), hide = $('hide'), showDots = $('show-dots'), showNames = $('show-names'), fontScale = $('font-scale'), fontScaleValue = $('font-scale-value');
  let network = null, nodes = [], edges = [], neighbours = new Map(), scale = 1, offsetX = 0, offsetY = 0;
  let width = 1, height = 1, frame = 0, tick = 0, drag = null, hovered = null, interacted = false;
  const send = message => webviewApi.postMessage(message);
  const number = value => `${value} ${value === 1 ? 'note' : 'notes'}`;
  function settings() { return { tagLimit: limit.value === '0' ? 0 : Math.max(1, Math.floor(Number(count.value) || 100)), hideDisconnected: hide.checked, showDots: showDots.checked, showNames: showNames.checked, fontScale: Math.max(50, Math.min(200, Math.round(Number(fontScale.value) || 100))) }; }
  function updateControls() {
    count.hidden = limit.value === '0';
    fontScale.disabled = !showNames.checked;
    fontScaleValue.textContent = `${settings().fontScale}%`;
  }
  let saveTimer;
  function controlsChanged() {
    updateControls();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { send({ type: 'settings', ...settings() }); rebuild(); }, 250);
  }
  limit.addEventListener('change', controlsChanged);
  count.addEventListener('change', controlsChanged);
  hide.addEventListener('change', controlsChanged);
  fontScale.addEventListener('input', controlsChanged);
  showDots.addEventListener('change', () => {
    if (!showDots.checked && !showNames.checked) showNames.checked = true;
    controlsChanged();
  });
  showNames.addEventListener('change', () => {
    if (!showNames.checked && !showDots.checked) showDots.checked = true;
    controlsChanged();
  });
  $('refresh').addEventListener('click', () => send({ type: 'refresh' }));
  function resize() {
    const rect = viewport.getBoundingClientRect();
    width = Math.max(1, rect.width - 2); height = Math.max(1, rect.height - 2);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!interacted) fit(true); else draw();
  }
  new ResizeObserver(resize).observe(viewport);
  function rebuild() {
    if (!network) return;
    const opts = settings();
    let selected = network.nodes.slice().sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id));
    if (opts.tagLimit) selected = selected.slice(0, opts.tagLimit);
    const ids = new Set(selected.map(n => n.id));
    const visibleEdges = network.edges.filter(e => ids.has(e.source) && ids.has(e.target));
    const connected = new Set(visibleEdges.flatMap(e => [e.source, e.target]));
    if (opts.hideDisconnected) selected = selected.filter(n => connected.has(n.id));
    const maxCount = selected.reduce((max, n) => Math.max(max, n.count), 1);
    $('legend').hidden = !opts.showDots;
    const connectedNodes = selected.filter(n => connected.has(n.id));
    const isolatedNodes = selected.filter(n => !connected.has(n.id));
    const ring = Math.max(160, Math.sqrt(connectedNodes.length) * 55, isolatedNodes.length * 14 / Math.PI);
    let connectedIndex = 0, isolatedIndex = 0;
    nodes = selected.map(n => {
      const isConnected = connected.has(n.id);
      const index = isConnected ? connectedIndex++ : isolatedIndex++;
      const angle = index * 2.399963229728653;
      const radius = isConnected ? 35 * Math.sqrt(index + 1) : ring + 35 * Math.floor(index / Math.max(1, Math.floor(ring / 14)));
      const intensity = Math.log1p(n.count) / Math.log1p(maxCount);
      const fontSize = (12 + 14 * intensity) * opts.fontScale / 100;
      const dotRadius = 4.5 + 4.5 * intensity;
      ctx.font = `600 ${fontSize}px sans-serif`;
      const textWidth = opts.showNames ? ctx.measureText(n.title).width : 0;
      return { ...n, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
        vx: 0, vy: 0, intensity, fontSize, dotRadius, textWidth,
        boxWidth: textWidth + (opts.showDots ? dotRadius * 2 : 0) + (opts.showDots && opts.showNames ? 7 : 0) + 8,
        boxHeight: Math.max(opts.showNames ? fontSize * 1.3 : 0, opts.showDots ? dotRadius * 2 : 0) + 4,
        isolated: !isConnected };
    });
    const byId = new Map(nodes.map(n => [n.id, n]));
    edges = visibleEdges.filter(e => byId.has(e.source) && byId.has(e.target)).map(e => ({ ...e, a: byId.get(e.source), b: byId.get(e.target) }));
    neighbours = new Map(network.nodes.map(n => [n.id, []]));
    const allById = new Map(network.nodes.map(n => [n.id, n]));
    network.edges.forEach(e => {
      neighbours.get(e.source).push({ title: allById.get(e.target).title, count: e.count });
      neighbours.get(e.target).push({ title: allById.get(e.source).title, count: e.count });
    });
    for (const list of neighbours.values()) list.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    status.textContent = nodes.length ? 'Arranging tags…' : (network.nodes.length ? 'No tags match these options.' : 'No tags yet.');
    const list = $('tag-list'); list.replaceChildren();
    for (const node of nodes) {
      const button = document.createElement('button');
      button.textContent = `${node.title} (${node.count})`;
      button.title = tooltipText(node);
      button.addEventListener('click', () => send({ type: 'openTag', id: node.id }));
      list.appendChild(button);
    }
    tick = 0; interacted = false; hovered = null; tip.hidden = true;
    cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height);
    if (nodes.length) frame = requestAnimationFrame(animate); else draw();
  }
  function fit(readable = false) {
    if (!nodes.length) { offsetX = width / 2; offsetY = height / 2; scale = 1; draw(); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) { minX = Math.min(minX, n.x - n.boxWidth / 2); maxX = Math.max(maxX, n.x + n.boxWidth / 2); minY = Math.min(minY, n.y - n.boxHeight / 2); maxY = Math.max(maxY, n.y + n.boxHeight / 2); }
    scale = Math.max(readable ? 1 : .01, Math.min(2, width / (maxX - minX), height / (maxY - minY)) * .9);
    offsetX = width / 2 - (minX + maxX) / 2 * scale; offsetY = height / 2 - (minY + maxY) / 2 * scale;
    draw();
  }
  // Nearby-node repulsion uses a spatial grid, avoiding an all-pairs calculation.
  function simulate() {
    const cellSize = 85, grid = new Map();
    for (const n of nodes) {
      const x = Math.floor(n.x / cellSize), y = Math.floor(n.y / cellSize), key = `${x},${y}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(n);
    }
    for (const n of nodes) {
      const gx = Math.floor(n.x / cellSize), gy = Math.floor(n.y / cellSize);
      for (let x = gx - 1; x <= gx + 1; x++) for (let y = gy - 1; y <= gy + 1; y++) {
        for (const other of grid.get(`${x},${y}`) || []) {
          if (other === n) continue;
          let dx = n.x - other.x, dy = n.y - other.y;
          const d2 = Math.max(4, dx * dx + dy * dy);
          if (d2 > 15000) continue;
          const force = Math.min(2.5, 320 / d2);
          n.vx += dx / Math.sqrt(d2) * force; n.vy += dy / Math.sqrt(d2) * force;
        }
      }
      if (!n.isolated) { n.vx -= n.x * .0008; n.vy -= n.y * .0008; }
    }
    for (const e of edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.max(1, Math.hypot(dx, dy));
      const desired = Math.max(38, 155 / (1 + Math.log1p(e.count) * .5));
      const f = Math.max(-1.5, Math.min(1.5, (d - desired) * .003 * (1 + Math.log1p(e.count))));
      e.a.vx += dx / d * f; e.a.vy += dy / d * f; e.b.vx -= dx / d * f; e.b.vy -= dy / d * f;
    }
    for (const n of nodes) {
      if (drag && drag.node === n) { n.vx = n.vy = 0; continue; }
      n.vx *= .82; n.vy *= .82; n.x += n.vx; n.y += n.vy;
    }
  }
  function animate() {
    // Arrange in batches, then remove label overlaps before showing the graph.
    for (let i = 0; i < 5 && tick < 100; i++, tick++) simulate();
    if (tick < 100) { frame = requestAnimationFrame(animate); return; }
    NetworkLayout.removeOverlaps(nodes);
    status.textContent = `${nodes.length} of ${network.nodes.length} tags · ${edges.length} ${edges.length === 1 ? 'connection' : 'connections'}`;
    if (!interacted) fit(true); else draw();
  }
  function heatColor(value) {
    const start = value < .5 ? [34, 114, 186] : [246, 188, 67];
    const end = value < .5 ? [246, 188, 67] : [210, 53, 41];
    const t = value < .5 ? value * 2 : (value - .5) * 2;
    return `rgb(${start.map((c, i) => Math.round(c + (end[i] - c) * t)).join(',')})`;
  }
  function edgePoint(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    if (!showNames.checked && showDots.checked) {
      const distance = Math.hypot(dx, dy) || 1;
      return { x: from.x + dx / distance * from.dotRadius, y: from.y + dy / distance * from.dotRadius };
    }
    const factor = Math.min(dx ? from.boxWidth / 2 / Math.abs(dx) : Infinity,
      dy ? from.boxHeight / 2 / Math.abs(dy) : Infinity);
    return { x: from.x + dx * factor, y: from.y + dy * factor };
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const css = getComputedStyle(document.body);
    const color = css.color || '#333';
    const background = css.backgroundColor || '#fff';
    ctx.save(); ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
    for (const e of edges) {
      const a = edgePoint(e.a, e.b), b = edgePoint(e.b, e.a);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color; ctx.globalAlpha = edges.length > 200 ? .11 : .25;
      ctx.lineWidth = Math.min(7, .6 + Math.log1p(e.count)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Paint the label backgrounds over edges so names remain legible.
    for (const n of nodes) {
      if (showNames.checked) {
        ctx.fillStyle = background;
        ctx.fillRect(n.x - n.boxWidth / 2, n.y - n.boxHeight / 2, n.boxWidth, n.boxHeight);
      }
      const left = n.x - n.boxWidth / 2 + 4;
      let textX = left;
      if (showDots.checked) {
        ctx.beginPath(); ctx.arc(left + n.dotRadius, n.y, n.dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = heatColor(n.intensity); ctx.fill(); textX += n.dotRadius * 2 + 7;
      }
      if (showNames.checked) {
        ctx.fillStyle = color; ctx.font = `600 ${n.fontSize}px sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(n.title, textX, n.y);
      }
      if (n === hovered) {
        ctx.strokeStyle = color; ctx.lineWidth = 1 / scale;
        if (showNames.checked) ctx.strokeRect(n.x - n.boxWidth / 2, n.y - n.boxHeight / 2, n.boxWidth, n.boxHeight);
        else { ctx.beginPath(); ctx.arc(n.x, n.y, n.dotRadius + 2 / scale, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  function tooltipText(node) {
    const links = (neighbours.get(node.id) || []).slice(0, 5);
    return `${node.title}\nUsed in ${number(node.count)}${links.length ? '\nMost frequent connections (all tags):\n' + links.map(n => `• ${n.title}: ${number(n.count)}`).join('\n') : '\nNo connections'}`;
  }
  function pos(event) { const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function hit(p) {
    const x = (p.x - offsetX) / scale, y = (p.y - offsetY) / scale;
    for (let i = nodes.length - 1; i >= 0; i--) if (Math.abs(x - nodes[i].x) <= nodes[i].boxWidth / 2 && Math.abs(y - nodes[i].y) <= nodes[i].boxHeight / 2) return nodes[i];
    return null;
  }
  function zoom(factor, x = width / 2, y = height / 2) {
    const next = Math.max(.01, Math.min(8, scale * factor));
    offsetX = x - (x - offsetX) * next / scale; offsetY = y - (y - offsetY) * next / scale; scale = next; interacted = true; draw();
  }
  $('zoom-in').addEventListener('click', () => zoom(1.3));
  $('zoom-out').addEventListener('click', () => zoom(1 / 1.3));
  $('fit').addEventListener('click', () => { interacted = true; fit(); });
  canvas.addEventListener('wheel', event => { event.preventDefault(); const p = pos(event); zoom(Math.exp(-event.deltaY * .001), p.x, p.y); }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = pos(event); drag = { start: p, last: p, node: hit(p), moved: false }; canvas.setPointerCapture(event.pointerId); tip.hidden = true;
  });
  canvas.addEventListener('pointermove', event => {
    const p = pos(event);
    if (drag) {
      if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 4) drag.moved = true;
      if (drag.moved) {
        interacted = true;
        if (drag.node) { drag.node.x += (p.x - drag.last.x) / scale; drag.node.y += (p.y - drag.last.y) / scale; }
        else { offsetX += p.x - drag.last.x; offsetY += p.y - drag.last.y; }
        draw();
      }
      drag.last = p; return;
    }
    hovered = hit(p); canvas.style.cursor = hovered ? 'pointer' : 'grab';
    tip.hidden = !hovered;
    if (hovered) { tip.textContent = tooltipText(hovered); tip.style.left = `${Math.max(0, Math.min(width - 180, p.x + 12))}px`; tip.style.top = `${Math.max(0, Math.min(height - 100, p.y + 12))}px`; }
    draw();
  });
  canvas.addEventListener('pointerup', event => {
    if (drag && !drag.moved && drag.node) send({ type: 'openTag', id: drag.node.id });
    if (drag && drag.moved && drag.node) { NetworkLayout.place(drag.node, nodes.filter(n => n !== drag.node)); draw(); }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { if (!drag) { hovered = null; tip.hidden = true; draw(); } });
  webviewApi.onMessage(event => {
    const message = event && event.message ? event.message : event;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'settings') { limit.value = message.tagLimit > 0 ? 'custom' : '0'; count.value = message.tagLimit > 0 ? message.tagLimit : 100; hide.checked = !!message.hideDisconnected; showDots.checked = message.showDots !== false; showNames.checked = message.showNames !== false; fontScale.value = Number.isInteger(message.fontScale) && message.fontScale >= 50 && message.fontScale <= 200 ? message.fontScale : 100; if (!showDots.checked && !showNames.checked) showDots.checked = true; updateControls(); rebuild(); }
    if (message.type === 'network') { network = message.network; rebuild(); }
    if (message.type === 'loading') status.textContent = message.hasData ? 'Refreshing network…' : 'Loading tags…';
    if (message.type === 'progress') status.textContent = `Reading tags: ${message.done} / ${message.total}…`;
    if (message.type === 'error') status.textContent = message.hasData ? 'Could not refresh; showing previous results. Try refresh again.' : 'Could not load tags. Try refresh again.';
  });
  updateControls(); send({ type: 'ready' });
})();
