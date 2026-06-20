/**
 * editorStore.test.js — Backend / Security-QA agent
 * Unit tests for editorStore contract enforcement.
 * Run:  node editorStore.test.js
 *
 * Uses no test framework — plain assert-style so there are zero dependencies.
 */

// Minimal shim: the store checks for window.pdfjsLib / window.PDFLib
// which won't exist in Node, so loadPdf will skip those branches.
globalThis.window = globalThis;

import editorStore from './editorStore.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function section(name) {
  console.log(`\n── ${name}`);
}

// ---- TESTS ----

section('Initial state');
assert(editorStore.state.fileName === null, 'fileName is null');
assert(editorStore.state.currentPage === 1, 'currentPage is 1');
assert(editorStore.state.zoom === 1.0, 'zoom is 1.0');
assert(editorStore.state.activeTool === 'select', 'activeTool is select');

section('Read-only proxy blocks mutation');
editorStore.state.fileName = 'hacked.pdf';
assert(editorStore.state.fileName === null, 'state.fileName unchanged after direct write');
editorStore.state.zoom = 999;
assert(editorStore.state.zoom === 1.0, 'state.zoom unchanged after direct write');

section('setPage validation');
editorStore.setPage(0);
assert(editorStore.state.currentPage === 1, 'setPage(0) rejected');
editorStore.setPage(-1);
assert(editorStore.state.currentPage === 1, 'setPage(-1) rejected');
editorStore.setPage(1.5);
assert(editorStore.state.currentPage === 1, 'setPage(1.5) rejected');
editorStore.setPage('abc');
assert(editorStore.state.currentPage === 1, 'setPage("abc") rejected');

section('setZoom validation and clamping');
editorStore.setZoom(0.05);
assert(editorStore.state.zoom === editorStore.MIN_ZOOM, 'zoom clamped to MIN_ZOOM');
editorStore.setZoom(10);
assert(editorStore.state.zoom === editorStore.MAX_ZOOM, 'zoom clamped to MAX_ZOOM');
editorStore.setZoom(1.5);
assert(editorStore.state.zoom === 1.5, 'zoom set to 1.5');
editorStore.setZoom(NaN);
assert(editorStore.state.zoom === 1.5, 'setZoom(NaN) rejected');
editorStore.setZoom(Infinity);
assert(editorStore.state.zoom === 1.5, 'setZoom(Infinity) rejected');

section('setActiveTool validation');
editorStore.setActiveTool('draw');
assert(editorStore.state.activeTool === 'draw', 'activeTool set to draw');
editorStore.setActiveTool(123);
assert(editorStore.state.activeTool === 'draw', 'setActiveTool(123) rejected');

section('reorderPages validation');
// No doc loaded so totalPages=0 — reorder with wrong length should be rejected
editorStore.reorderPages([1, 0]);
assert(editorStore.state.pageOrder.length === 0, 'reorderPages with wrong length rejected');
editorStore.reorderPages('not-array');
assert(editorStore.state.pageOrder.length === 0, 'reorderPages(string) rejected');

section('addEdit / updateEdit / removeEdit');
const editId = editorStore.addEdit({ type: 'text', page: 0, x: 10, y: 20 });
assert(typeof editId === 'string' && editId.startsWith('edit_'), 'addEdit returns edit id');
assert(editorStore.state.edits.length === 1, 'edits has one entry');
assert(editorStore.addEdit(null) === null, 'addEdit(null) returns null');
assert(editorStore.addEdit(42) === null, 'addEdit(42) returns null');

editorStore.updateEdit(editId, { x: 50 });
const updatedEdit = editorStore.state.edits.find(e => e.id === editId);
assert(updatedEdit && updatedEdit.x === 50, 'updateEdit changed x to 50');

editorStore.removeEdit(editId);
assert(editorStore.state.edits.length === 0, 'removeEdit cleared the edit');

section('subscribe validation');
let threw = false;
try { editorStore.subscribe('not-a-function'); } catch { threw = true; }
assert(threw, 'subscribe("string") throws TypeError');

section('subscribe + notify');
let notifyCount = 0;
const unsub = editorStore.subscribe(() => { notifyCount++; });
editorStore.setActiveTool('text');
// Notifications are microtask-batched, so wait for flush
await new Promise(r => setTimeout(r, 10));
assert(notifyCount >= 1, 'subscriber was called after setActiveTool');
unsub();
const prevCount = notifyCount;
editorStore.setActiveTool('select');
await new Promise(r => setTimeout(r, 10));
assert(notifyCount === prevCount, 'unsubscribed listener not called');

section('reset');
editorStore.setZoom(2.0);
editorStore.setActiveTool('draw');
editorStore.reset();
await new Promise(r => setTimeout(r, 10));
assert(editorStore.state.zoom === 1.0, 'reset restored zoom to 1.0');
assert(editorStore.state.activeTool === 'select', 'reset restored activeTool');
assert(editorStore.state.fileName === null, 'reset cleared fileName');

section('rotatePage negative degrees');
// Simulate a loaded doc state for rotation tests
// We can't call loadPdf without pdf.js, so test rotation on page 0 anyway
editorStore.rotatePage(0, -90);
// With totalPages=0, the validation should reject index 0
assert((editorStore.state.rotations[0] || 0) === 0, 'rotatePage rejected index >= totalPages');

// ---- SUMMARY ----
console.log(`\n${'═'.repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);
