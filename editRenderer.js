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
      } else if (edit.type === 'shape' || edit.type === 'highlight' || edit.type === 'whiteout') {
        this.drawShape(ctx, edit, viewport);
      } else if (edit.type === 'draw') {
        this.drawPath(ctx, edit, viewport);
      } else if (edit.type === 'image') {
        this.drawImage(ctx, edit, viewport);
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
  },

  drawShape(ctx, edit, viewport) {
    let { x, y, startX, startY, payload } = edit;
    let { width, height, color, borderColor, borderWidth, opacity, blendMode } = payload;

    // Use startX, startY if available (during drawing), otherwise x, y
    let rectX = startX !== undefined ? startX : x;
    let rectY = startY !== undefined ? startY : y;

    // Normalize width and height if negative
    if (width < 0) { rectX += width; width = Math.abs(width); }
    if (height < 0) { rectY += height; height = Math.abs(height); }

    // Convert PDF points to screen coordinates
    const [screenX, screenY] = viewport.convertToViewportPoint(rectX, rectY);
    // Convert PDF dimensions to screen dimensions
    const [screenX2, screenY2] = viewport.convertToViewportPoint(rectX + width, rectY + height);
    
    const screenWidth = Math.abs(screenX2 - screenX);
    const screenHeight = Math.abs(screenY2 - screenY);
    
    // ConvertToViewportPoint handles rotation. If viewport is rotated, screenX, screenY might not be top-left.
    // For rectangles, we should just use standard fillRect for now (assuming no rotation, or handle it via rect).
    // Actually pdf.js `convertToViewportPoint` gives exact screen point.
    // A simple approach is min/max to get top-left.
    const tX = Math.min(screenX, screenX2);
    const tY = Math.min(screenY, screenY2);

    ctx.save();
    
    if (opacity !== undefined) ctx.globalAlpha = opacity;
    if (blendMode !== undefined) ctx.globalCompositeOperation = blendMode;

    ctx.fillStyle = color;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth * viewport.scale;

    ctx.beginPath();
    ctx.rect(tX, tY, screenWidth, screenHeight);
    
    if (color !== 'transparent') ctx.fill();
    if (borderWidth > 0) ctx.stroke();
    
    ctx.restore();
  },

  drawPath(ctx, edit, viewport) {
    const { points, color, borderWidth } = edit.payload;
    if (!points || points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = borderWidth * viewport.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const [startX, startY] = viewport.convertToViewportPoint(points[0][0], points[0][1]);
    ctx.moveTo(startX, startY);

    for (let i = 1; i < points.length; i++) {
      const [x, y] = viewport.convertToViewportPoint(points[i][0], points[i][1]);
      ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  },

  drawImage(ctx, edit, viewport) {
    const { x, y, payload } = edit;
    const { dataUrl, width, height } = payload;
    
    // We can cache the Image object on the edit payload to avoid reloading
    if (!edit.cachedImage) {
      const img = new Image();
      img.onload = () => {
        edit.cachedImage = img;
        // Trigger a re-render. We can rely on editorStore or just draw if it's available.
        // It's a bit hacky to rely on next render, but it should be fast.
        // Better: when it loads, draw it immediately if ctx is still valid.
      };
      img.src = dataUrl;
    }

    if (edit.cachedImage) {
      const [screenX, screenY] = viewport.convertToViewportPoint(x, y);
      const [screenX2, screenY2] = viewport.convertToViewportPoint(x + width, y + height);
      
      const screenWidth = Math.abs(screenX2 - screenX);
      const screenHeight = Math.abs(screenY2 - screenY);
      
      const tX = Math.min(screenX, screenX2);
      const tY = Math.min(screenY, screenY2);

      ctx.save();
      ctx.drawImage(edit.cachedImage, tX, tY, screenWidth, screenHeight);
      ctx.restore();
    }
  }
};

export default editRenderer;
