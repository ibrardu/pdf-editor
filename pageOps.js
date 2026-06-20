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

  // ---- DELETE / RESTORE (feat #5) ----

  /**
   * Toggle deletion state for a page by its original 0-based index.
   * Cannot delete if it would leave zero visible pages.
   * @param {number} originalIndex — 0-based
   * @returns {boolean} true if the toggle succeeded
   */
  toggleDelete(originalIndex) {
    if (editorStore.state.deletedPages.has(originalIndex)) {
      editorStore.restorePage(originalIndex);
      return true;
    }
    // Prevent deleting all pages
    const visible = editorStore.getVisiblePages();
    if (visible.length <= 1) return false;
    editorStore.deletePage(originalIndex);
    return true;
  },

  /**
   * Check if a page is marked as deleted.
   * @param {number} originalIndex — 0-based
   * @returns {boolean}
   */
  isPageDeleted(originalIndex) {
    return editorStore.state.deletedPages.has(originalIndex);
  },

  // ---- ROTATE (feat #6) ----

  /**
   * Rotate a page by 90 degrees clockwise.
   * @param {number} originalIndex — 0-based
   */
  rotateClockwise(originalIndex) {
    editorStore.rotatePage(originalIndex, 90);
  },

  /**
   * Rotate a page by 90 degrees counter-clockwise.
   * @param {number} originalIndex — 0-based
   */
  rotateCounterClockwise(originalIndex) {
    editorStore.rotatePage(originalIndex, -90);
  },
};

export default pageOps;
