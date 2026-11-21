'use strict';
// Greedily remove rectangular label overlaps while retaining the positions
// produced by the force layout. Candidates move along one axis; whichever
// axis needs the smaller displacement is used. A gap is left around each box.
const NetworkLayout = (() => {
  function nearestFree(value, intervals) {
    intervals.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < intervals.length;) {
      let [start, end] = intervals[i++];
      while (i < intervals.length && intervals[i][0] <= end) end = Math.max(end, intervals[i++][1]);
      if (value > start && value < end) return value - start <= end - value ? start : end;
      if (value <= start) break;
    }
    return value;
  }
  function place(node, placed, gap = 6) {
    const horizontal = [], vertical = [];
    for (const other of placed) {
      const halfWidth = (node.boxWidth + other.boxWidth) / 2 + gap;
      const halfHeight = (node.boxHeight + other.boxHeight) / 2 + gap;
      if (Math.abs(node.y - other.y) < halfHeight) horizontal.push([other.x - halfWidth, other.x + halfWidth]);
      if (Math.abs(node.x - other.x) < halfWidth) vertical.push([other.y - halfHeight, other.y + halfHeight]);
    }
    const x = nearestFree(node.x, horizontal);
    const y = nearestFree(node.y, vertical);
    if (Math.abs(x - node.x) < Math.abs(y - node.y)) node.x = x;
    else node.y = y;
    return node;
  }
  function removeOverlaps(nodes, gap = 6) {
    const placed = [];
    for (const node of nodes) { place(node, placed, gap); placed.push(node); }
    return nodes;
  }
  return { nearestFree, place, removeOverlaps };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NetworkLayout;
