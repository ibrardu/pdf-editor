/**
 * editRenderer.js — Frontend/Shared
 * Draws edits from state onto a 2D canvas context.
 */

const editRenderer = {
  /**
   * Draw all edits for a page onto the overlay context.
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Array} edits 
   * @param {Object} viewport - pdf.js viewport to map PDF points to screen pixels
   */
  drawEdits(ctx, edits, viewport) {
    for (const edit of edits) {
      if (edit.type === 'text') {
        this.drawText(ctx, edit, viewport);
      }
      // Add more types here later
    }
  },

  drawText(ctx, edit, viewport) {
    const { x, y, payload } = edit;
    const { text, fontSize, color, fontFamily } = payload;

    // Convert PDF points back to screen pixels for rendering
    const [screenX, screenY] = viewport.convertToViewportPoint(x, y);

    // Scale font size
    const screenFontSize = fontSize * viewport.scale;

    ctx.save();
    // Since pdf.js handles rotation via viewport, convertToViewportPoint handles rotation/scaling!
    // But text baseline and orientation matters. For now, we assume horizontal text.
    // Ideally we should apply viewport transform directly, but simple positioning is okay for basic text.
    ctx.font = `${screenFontSize}px ${fontFamily}, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';

    // Handle multiline
    const lines = text.split('\n');
    let currentY = screenY;
    const lineHeight = screenFontSize * 1.2;

    for (const line of lines) {
      ctx.fillText(line, screenX, currentY);
      currentY += lineHeight;
    }
    
    ctx.restore();
  }
};

export default editRenderer;
