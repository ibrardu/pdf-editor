/**
 * pdfRenderer.js — Backend agent
 * Renders PDF pages to canvas elements using pdf.js.
 * Reads state from editorStore (read-only); never mutates state.
 */
import editorStore from './editorStore.js';

const pdfRenderer = {
  /**
   * Render a single page to a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {number} pageNumber — 1-based
   * @param {object} [options]
   * @param {number} [options.scale] — override editorStore.state.zoom
   * @returns {Promise<void>}
   */
  async renderPage(canvas, pageNumber, options = {}) {
    const { pdfJsDoc, zoom, rotations } = editorStore.state;
    if (!pdfJsDoc) return;

    const scale = options.scale ?? zoom;
    const rotation = rotations[pageNumber - 1] || 0;

    const page = await pdfJsDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale, rotation });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Sync overlay if this is the main canvas
    if (canvas.id === 'pdf-canvas') {
      const wrapper = document.getElementById('canvas-wrapper');
      const overlay = document.getElementById('overlay-canvas');
      const ui = document.getElementById('overlay-ui');
      if (wrapper && overlay && ui) {
        wrapper.style.width = `${viewport.width}px`;
        wrapper.style.height = `${viewport.height}px`;
        overlay.width = viewport.width;
        overlay.height = viewport.height;
      }
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
  },

  /**
   * Render a thumbnail-sized version of a page (scale 0.25).
   * @param {HTMLCanvasElement} canvas
   * @param {number} pageNumber — 1-based
   * @returns {Promise<void>}
   */
  async renderThumbnail(canvas, pageNumber) {
    return this.renderPage(canvas, pageNumber, { scale: 0.25 });
  },
};

export default pdfRenderer;
