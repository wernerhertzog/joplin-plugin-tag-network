'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { removeOverlaps, place } = require('../src/layout');

function assertSeparated(nodes, gap = 6) {
  for (let i = 0; i < nodes.length; i++) for (let j = 0; j < i; j++) {
    const a = nodes[i], b = nodes[j];
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    assert.ok(dx + 1e-8 >= (a.boxWidth + b.boxWidth) / 2 + gap || dy + 1e-8 >= (a.boxHeight + b.boxHeight) / 2 + gap, `Labels ${i} and ${j} overlap`);
  }
}
test('separates measured labels even when all nodes start together', () => {
  const nodes = Array.from({ length: 150 }, (_, i) => ({ x: 0, y: 0, boxWidth: 30 + i % 19 * 11, boxHeight: 15 + i % 5 * 4 }));
  removeOverlaps(nodes);
  assertSeparated(nodes);
});
test('preserves separated positions and relocates a dragged tag', () => {
  const nodes = [{ x: 0, y: 0, boxWidth: 100, boxHeight: 20 }, { x: 200, y: 0, boxWidth: 100, boxHeight: 20 }];
  removeOverlaps(nodes);
  assert.equal(nodes[1].x, 200);
  nodes[1].x = 0;
  place(nodes[1], [nodes[0]]);
  assertSeparated(nodes);
});
test('separates crowded mixed-size labels at fractional positions', () => {
  const nodes = Array.from({ length: 100 }, (_, i) => ({ x: (i % 10) * 5.2, y: Math.floor(i / 10) * 4.3, boxWidth: 40.3 + (i % 7) * 12.6, boxHeight: 19.5 + (i % 4) * 4.2 }));
  removeOverlaps(nodes);
  assertSeparated(nodes);
});
