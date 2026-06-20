/**
 * pageOps.js — Backend agent
 * Higher-level page operations built on editorStore public methods.
 * Each Wave-2 feature adds to this module.
 */
import editorStore from './editorStore.js';

const pageOps = {
  // ---- REORDER (feat #4) ----

  /**
   * Move a page from one display position to another.
   * @param {number} fromIndex — 0-based position in current pageOrder
   * @param {number} toIndex   — 0-based target position
   */
  movePage(fromIndex, toIndex) {
    const order = [...editorStore.state.pageOrder];
    if (
      fromIndex < 0 || fromIndex >= order.length ||
      toIndex < 0 || toIndex >= order.length ||
      fromIndex === toIndex
    ) return;
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    editorStore.reorderPages(order);
  },

  /**
   * Map a 1-based display position to the 1-based original page number
   * that pdf.js expects, respecting the current pageOrder.
   * @param {number} displayPos — 1-based
   * @returns {number} 1-based original page number
   */
  displayToOriginalPage(displayPos) {
    const order = editorStore.state.pageOrder;
    const idx = displayPos - 1;
    if (idx < 0 || idx >= order.length) return displayPos;
    return order[idx] + 1;
  },
};

export default pageOps;
