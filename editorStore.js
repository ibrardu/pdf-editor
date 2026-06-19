/**
 * editorStore.js
 * Single source of truth for the PDF editor.
 * All feature branches read/write ONLY through these methods.
 * Never mutate state directly from outside this file.
 */

const listeners = new Set();
let historySnapshotInFlight = false;

const state = {
  // ---- CORE DOCUMENT STATE ----
  fileName: null,
  originalBytes: null,      // Uint8Array of uploaded PDF
  pdfDoc: null,              // pdf-lib PDFDocument instance (mutable working copy)
  pdfJsDoc: null,             // pdf.js document instance (for rendering only)
  totalPages: 0,
  currentPage: 1,
  zoom: 1.0,

  // ---- PAGE OPERATIONS ----
  pageOrder: [],             // array of original page indices, reordered by user
  deletedPages: new Set(),   // indices marked for deletion
  rotations: {},              // { pageIndex: degrees }

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

function notify() {
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch (err) {
      console.error('editorStore listener error:', err);
    }
  });
}

function deepCloneState() {
  return {
    ...state,
    deletedPages: new Set(state.deletedPages),
    rotations: { ...state.rotations },
    edits: state.edits.map((e) => ({ ...e })),
    pageOrder: [...state.pageOrder],
  };
}

const editorStore = {
  state, // read-only inspection; do not mutate directly from outside

  // ---- DOCUMENT LOADING ----
  async loadPdf(bytes, fileName) {
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
    notify();
  },

  setPage(index) {
    if (index < 1 || index > state.totalPages) return;
    state.currentPage = index;
    notify();
  },

  setZoom(level) {
    state.zoom = Math.max(0.1, level);
    notify();
  },

  // ---- PAGE OPERATIONS ----
  reorderPages(newOrderArray) {
    state.pageOrder = [...newOrderArray];
    notify();
  },

  deletePage(index) {
    state.deletedPages.add(index);
    notify();
  },

  restorePage(index) {
    state.deletedPages.delete(index);
    notify();
  },

  rotatePage(index, degrees) {
    const current = state.rotations[index] || 0;
    state.rotations[index] = (current + degrees) % 360;
    notify();
  },

  // ---- CONTENT EDITS ----
  addEdit(editObject) {
    const id = `edit_${nextEditId++}`;
    state.edits.push({ id, ...editObject });
    notify();
    return id;
  },

  updateEdit(id, changes) {
    const edit = state.edits.find((e) => e.id === id);
    if (!edit) return;
    Object.assign(edit, changes);
    notify();
  },

  removeEdit(id) {
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
    Object.assign(state, state.history[state.historyIndex]);
    notify();
  },

  redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    Object.assign(state, state.history[state.historyIndex]);
    notify();
  },

  // ---- SUBSCRIPTIONS ----
  subscribe(callback) {
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
