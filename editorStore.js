/**
 * editorStore.js
 * Single source of truth for the PDF editor.
 * All feature branches read/write ONLY through these methods.
 * Never mutate state directly from outside this file.
 *
 * Hardened in feat(#3):
 *  - state is exposed through a frozen read-only proxy
 *  - setters validate inputs
 *  - zoom is clamped between MIN_ZOOM and MAX_ZOOM
 *  - reset() clears everything for a fresh start
 *  - notify() is batched via microtask to prevent render storms
 */

const listeners = new Set();
let historySnapshotInFlight = false;
let notifyScheduled = false;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_DECIMALS = 2;

const state = {
  // ---- CORE DOCUMENT STATE ----
  fileName: null,
  originalBytes: null,       // Uint8Array of uploaded PDF
  pdfDoc: null,              // pdf-lib PDFDocument instance (mutable working copy)
  pdfJsDoc: null,            // pdf.js document instance (for rendering only)
  totalPages: 0,
  currentPage: 1,
  zoom: 1.0,

  // ---- PAGE OPERATIONS ----
  pageOrder: [],             // array of original page indices, reordered by user
  deletedPages: new Set(),   // indices marked for deletion
  rotations: {},             // { pageIndex: degrees }

  // ---- CONTENT EDITS ----
  edits: [
    // { id, type: 'text'|'shape'|'draw'|'highlight'|'image'|'whiteout',
    //   page: number, x, y, width, height, payload: {...} }
  ],

  // ---- SIGN & SECURE ----
  signature: null,
  password: null,
  watermark: null,

  // ---- UI / HISTORY ----
  history: [],
  historyIndex: -1,
  activeTool: 'select',
};

let nextEditId = 1;

// ---- NOTIFICATION (microtask-batched) ----
function notify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(flushNotify);
}

function flushNotify() {
  notifyScheduled = false;
  const snapshot = readOnlyProxy;
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (err) {
      console.error('editorStore listener error:', err);
    }
  });
}

// ---- READ-ONLY PROXY ----
// Prevents accidental external mutation while still exposing current values.
const readOnlyProxy = new Proxy(state, {
  get(target, prop) {
    const val = target[prop];
    // Wrap Set as frozen array for consumers
    if (prop === 'deletedPages') return new Set(val);
    // Wrap arrays as copies
    if (prop === 'pageOrder') return [...val];
    if (prop === 'edits') return val.map((e) => ({ ...e }));
    if (prop === 'history') return []; // don't leak mutable history
    // Wrap plain objects as copies
    if (prop === 'rotations') return { ...val };
    return val;
  },
  set(_target, prop) {
    console.warn(`editorStore.state.${prop} is read-only. Use editorStore methods to update state.`);
    return true; // return true to avoid throwing in strict mode; value is simply not set
  },
  deleteProperty(_target, prop) {
    console.warn(`editorStore.state.${prop} is read-only.`);
    return true;
  },
});

function deepCloneState() {
  return {
    fileName: state.fileName,
    originalBytes: state.originalBytes,
    pdfDoc: state.pdfDoc,
    pdfJsDoc: state.pdfJsDoc,
    totalPages: state.totalPages,
    currentPage: state.currentPage,
    zoom: state.zoom,
    pageOrder: [...state.pageOrder],
    deletedPages: new Set(state.deletedPages),
    rotations: { ...state.rotations },
    edits: state.edits.map((e) => ({ ...e })),
    signature: state.signature,
    password: state.password,
    watermark: state.watermark,
    activeTool: state.activeTool,
    // history/historyIndex excluded — snapshots don't include their own history
  };
}

// ---- VALIDATION HELPERS ----
function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}

function isFiniteNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

const editorStore = {
  /** Read-only state proxy. Use editorStore methods to mutate. */
  get state() {
    return readOnlyProxy;
  },

  /** Zoom bounds exposed for UI controls */
  MIN_ZOOM,
  MAX_ZOOM,

  // ---- DOCUMENT LOADING ----
  async loadPdf(bytes, fileName) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      throw new TypeError('loadPdf requires a non-empty Uint8Array');
    }
    if (typeof fileName !== 'string' || fileName.length === 0) {
      throw new TypeError('loadPdf requires a non-empty fileName string');
    }

    state.originalBytes = bytes;
    state.fileName = fileName;

    if (typeof window !== 'undefined' && window.pdfjsLib) {
      state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      state.totalPages = state.pdfJsDoc.numPages;
    }

    if (typeof window !== 'undefined' && window.PDFLib) {
      state.pdfDoc = await window.PDFLib.PDFDocument.load(bytes);
      if (!state.totalPages) {
        state.totalPages = state.pdfDoc.getPageCount();
      }
    }

    state.pageOrder = Array.from({ length: state.totalPages }, (_, i) => i);
    state.deletedPages = new Set();
    state.rotations = {};
    state.edits = [];
    state.currentPage = 1;
    state.history = [];
    state.historyIndex = -1;
    nextEditId = 1;
    notify();
  },

  setPage(index) {
    if (!isPositiveInt(index)) return;
    if (index < 1 || index > state.totalPages) return;
    state.currentPage = index;
    notify();
  },

  setZoom(level) {
    if (!isFiniteNum(level)) return;
    state.zoom = parseFloat(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level)).toFixed(ZOOM_DECIMALS));
    notify();
  },

  // ---- PAGE OPERATIONS ----
  reorderPages(newOrderArray) {
    if (!Array.isArray(newOrderArray)) return;
    if (newOrderArray.length !== state.totalPages) return;
    state.pageOrder = [...newOrderArray];
    notify();
  },

  deletePage(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.totalPages) return;
    // Prevent deleting all pages
    if (state.deletedPages.size >= state.totalPages - 1 && !state.deletedPages.has(index)) return;
    state.deletedPages.add(index);
    notify();
  },

  restorePage(index) {
    state.deletedPages.delete(index);
    notify();
  },

  rotatePage(index, degrees) {
    if (!Number.isInteger(index) || index < 0 || index >= state.totalPages) return;
    if (!isFiniteNum(degrees)) return;
    const current = state.rotations[index] || 0;
    state.rotations[index] = ((current + degrees) % 360 + 360) % 360;
    notify();
  },

  // ---- CONTENT EDITS ----
  addEdit(editObject) {
    if (!editObject || typeof editObject !== 'object') return null;
    const id = `edit_${nextEditId++}`;
    state.edits.push({ id, ...editObject });
    notify();
    return id;
  },

  updateEdit(id, changes) {
    if (typeof id !== 'string' || !changes) return;
    const edit = state.edits.find((e) => e.id === id);
    if (!edit) return;
    Object.assign(edit, changes);
    notify();
  },

  removeEdit(id) {
    if (typeof id !== 'string') return;
    state.edits = state.edits.filter((e) => e.id !== id);
    notify();
  },

  // ---- SIGN & SECURE ----
  setSignature(payload) {
    state.signature = payload;
    notify();
  },

  setPassword(pw) {
    state.password = pw;
    notify();
  },

  setWatermark(payload) {
    state.watermark = payload;
    notify();
  },

  // ---- UI ----
  setActiveTool(toolName) {
    if (typeof toolName !== 'string') return;
    state.activeTool = toolName;
    notify();
  },

  // ---- HISTORY (undo/redo) ----
  snapshot() {
    if (historySnapshotInFlight) return;
    historySnapshotInFlight = true;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(deepCloneState());
    state.historyIndex = state.history.length - 1;
    historySnapshotInFlight = false;
  },

  undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    const snap = state.history[state.historyIndex];
    if (!snap) return;
    state.fileName = snap.fileName;
    state.originalBytes = snap.originalBytes;
    state.pdfDoc = snap.pdfDoc;
    state.pdfJsDoc = snap.pdfJsDoc;
    state.totalPages = snap.totalPages;
    state.currentPage = snap.currentPage;
    state.zoom = snap.zoom;
    state.pageOrder = [...snap.pageOrder];
    state.deletedPages = new Set(snap.deletedPages);
    state.rotations = { ...snap.rotations };
    state.edits = snap.edits.map((e) => ({ ...e }));
    state.signature = snap.signature;
    state.password = snap.password;
    state.watermark = snap.watermark;
    state.activeTool = snap.activeTool;
    notify();
  },

  redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    const snap = state.history[state.historyIndex];
    if (!snap) return;
    state.fileName = snap.fileName;
    state.originalBytes = snap.originalBytes;
    state.pdfDoc = snap.pdfDoc;
    state.pdfJsDoc = snap.pdfJsDoc;
    state.totalPages = snap.totalPages;
    state.currentPage = snap.currentPage;
    state.zoom = snap.zoom;
    state.pageOrder = [...snap.pageOrder];
    state.deletedPages = new Set(snap.deletedPages);
    state.rotations = { ...snap.rotations };
    state.edits = snap.edits.map((e) => ({ ...e }));
    state.signature = snap.signature;
    state.password = snap.password;
    state.watermark = snap.watermark;
    state.activeTool = snap.activeTool;
    notify();
  },

  // ---- RESET ----
  reset() {
    state.fileName = null;
    state.originalBytes = null;
    state.pdfDoc = null;
    state.pdfJsDoc = null;
    state.totalPages = 0;
    state.currentPage = 1;
    state.zoom = 1.0;
    state.pageOrder = [];
    state.deletedPages = new Set();
    state.rotations = {};
    state.edits = [];
    state.signature = null;
    state.password = null;
    state.watermark = null;
    state.history = [];
    state.historyIndex = -1;
    state.activeTool = 'select';
    nextEditId = 1;
    notify();
  },

  // ---- SUBSCRIPTIONS ----
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('subscribe requires a function');
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  // ---- READ-ONLY GETTERS ----
  getVisiblePages() {
    return state.pageOrder.filter((i) => !state.deletedPages.has(i));
  },

  getEditsForPage(pageIndex) {
    return state.edits.filter((e) => e.page === pageIndex);
  },

  getExportPagePayload() {
    return {
      pageOrder: editorStore.getVisiblePages(),
      rotations: { ...state.rotations },
      edits: [...state.edits],
      signature: state.signature,
      password: state.password,
      watermark: state.watermark,
    };
  },
};

export default editorStore;
