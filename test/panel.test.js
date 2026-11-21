'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const NetworkLayout = require('../src/layout');

test('dots-only mode keeps hover and click actions and cannot hide both representations', () => {
  const elements = new Map();
  function element(id = '') {
    if (elements.has(id)) return elements.get(id);
    const el = {
      id, value: id === 'limit' ? '0' : '100', checked: id === 'show-dots' || id === 'show-names', hidden: false,
      textContent: '', style: {}, listeners: {}, children: [],
      addEventListener(type, fn) { this.listeners[type] = fn; },
      dispatch(type, data = {}) { this.listeners[type]?.({ ...data, preventDefault() {} }); },
      replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); },
      getBoundingClientRect() { return { width: 500, height: 500, left: 0, top: 0 }; }, setPointerCapture() {},
    };
    elements.set(id, el); return el;
  }
  const canvas = element('graph');
  const context = {
    arcs: [], texts: [], textFonts: [], rects: 0, strokeRects: 0, tx: 0, ty: 0, zoom: 1,
    clearRect() { this.arcs = []; this.texts = []; this.textFonts = []; this.rects = 0; this.strokeRects = 0; }, setTransform() {}, save() {}, restore() {},
    translate(x, y) { this.tx = x; this.ty = y; }, scale(s) { this.zoom = s; },
    measureText(text) { return { width: text.length * 9 }; },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() { this.rects++; }, strokeRect() { this.strokeRects++; },
    arc(x, y) { this.arcs.push({ x: this.tx + x * this.zoom, y: this.ty + y * this.zoom }); },
    fillText(text) { this.texts.push(text); this.textFonts.push(this.font); },
  };
  canvas.getContext = () => context;
  const messages = [], frames = new Map();
  let nextFrame = 0, onMessage;
  const sandbox = {
    document: { getElementById: element, createElement: () => element(`created-${Math.random()}`), body: {} },
    getComputedStyle: () => ({ color: '#333', backgroundColor: '#fff' }), window: { devicePixelRatio: 1 }, NetworkLayout,
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } },
    requestAnimationFrame: fn => { const id = ++nextFrame; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout: fn => { fn(); return 1; }, clearTimeout() {},
    webviewApi: { postMessage: msg => messages.push(msg), onMessage: fn => { onMessage = fn; } },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/webview'), 'utf8'), sandbox);
  const flush = () => { while (frames.size) { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(); } };
  onMessage({ message: { type: 'settings', tagLimit: 0, hideDisconnected: false, showDots: true, showNames: true, fontScale: 150 } });
  onMessage({ message: { type: 'network', network: { nodes: [{ id: 'a', title: 'Fieldwork', count: 7 }], edges: [] } } });
  flush();
  assert.deepEqual(context.texts, ['Fieldwork']);
  assert.deepEqual(context.textFonts, ['600 39px sans-serif']);
  assert.equal(element('font-scale-value').textContent, '150%');
  assert.equal(context.rects, 1);
  element('font-scale').value = '50';
  element('font-scale').dispatch('input');
  flush();
  assert.deepEqual(context.textFonts, ['600 13px sans-serif']);
  assert.equal(element('font-scale-value').textContent, '50%');
  assert.ok(messages.some(m => m.type === 'settings' && m.fontScale === 50));
  element('show-names').checked = false;
  element('show-names').dispatch('change');
  flush();
  assert.deepEqual(context.texts, []);
  assert.equal(context.arcs.length, 1);
  assert.equal(context.rects, 0);
  assert.equal(element('font-scale').disabled, true);
  const dot = context.arcs[0];
  canvas.dispatch('pointermove', { clientX: dot.x, clientY: dot.y });
  assert.equal(element('tooltip').hidden, false);
  assert.equal(context.rects, 0);
  assert.equal(context.strokeRects, 0);
  assert.match(element('tooltip').textContent, /Fieldwork\nUsed in 7 notes/);
  canvas.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: dot.x, clientY: dot.y });
  canvas.dispatch('pointerup', { pointerId: 1, clientX: dot.x, clientY: dot.y });
  assert.ok(messages.some(m => m.type === 'openTag' && m.id === 'a'));
  assert.ok(messages.some(m => m.type === 'settings' && m.showNames === false && m.showDots === true));
  element('show-dots').checked = false;
  element('show-dots').dispatch('change');
  flush();
  assert.equal(element('show-names').checked, true);
  assert.equal(element('font-scale').disabled, false);
  assert.deepEqual(context.texts, ['Fieldwork']);
  assert.equal(context.arcs.length, 0);
});
