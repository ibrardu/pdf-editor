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

  // ---- EXTRACT (feat #7) ----

  /**
   * Extract a single page and download it as a new PDF.
   * @param {number} originalIndex — 0-based
   */
  async extractPage(originalIndex) {
    if (!editorStore.state.originalBytes) return;
    try {
      const PDFDocument = window.PDFLib.PDFDocument;
      const srcDoc = await PDFDocument.load(editorStore.state.originalBytes);
      const newDoc = await PDFDocument.create();
      
      const [copiedPage] = await newDoc.copyPages(srcDoc, [originalIndex]);
      newDoc.addPage(copiedPage);
      
      // Apply rotation if needed
      const currentRot = editorStore.state.rotations[originalIndex] || 0;
      if (currentRot !== 0) {
        const pages = newDoc.getPages();
        const page = pages[0];
        const existingRot = page.getRotation().angle;
        page.setRotation({ type: window.PDFLib.RotationTypes.Degrees, angle: (existingRot + currentRot) % 360 });
      }
      
      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const nameParts = (editorStore.state.fileName || 'extracted.pdf').split('.');
      const ext = nameParts.length > 1 ? '.' + nameParts.pop() : '';
      a.download = `${nameParts.join('.')}_page_${originalIndex + 1}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to extract page:', err);
    }
  },

  // ---- MERGE (feat #8) ----
  
  /**
   * Append pages from another PDF file to the current document.
   * @param {File} file
   */
  async mergePdf(file) {
    if (!editorStore.state.originalBytes) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      await editorStore.appendPdf(bytes);
    } catch (err) {
      console.error('Failed to merge PDF:', err);
      alert('Failed to merge PDF: ' + err.message);
    }
  },
};

export default pageOps;
