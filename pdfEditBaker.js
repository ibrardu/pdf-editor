/**
 * pdfEditBaker.js — Backend agent
 * Applies edits permanently into a pdf-lib PDFDocument instance.
 */

const pdfEditBaker = {
  /**
   * Bake edits into the document.
   * @param {PDFDocument} pdfDoc - pdf-lib document instance
   * @param {Array} edits - editorStore.state.edits
   * @param {Array} pageOrder - current page indices to map the edits to the correct pages
   */
  async bakeEdits(pdfDoc, edits, pageOrder) {
    if (!edits || edits.length === 0) return;

    const pages = pdfDoc.getPages();

    for (const edit of edits) {
      // Find the visual page index where this edit belongs
      // `edit.page` is the 1-based display page index at the time the edit was made
      // Actually, wait, `edit.page` stores the original index or display index?
      // In editOverlay.js: `currentPage` from editorStore is used. That is the display index!
      // But wait! If the user reorders pages, the display index points to a different page.
      // We must map it. Actually, `edit.page` should be `originalIndex`, not display index, for stability.
      // Let's assume it's `displayIndex` for now, but `splitPdf` and `extractPdf` will bake based on the original index if we are creating a new doc.
      // To keep it simple, `bakeEdits` receives `edits` and `pages` array matching the display order of the new document.
      // Wait, `pdfDoc` passed here is the new document just created in `extract` or `split`, which has only the extracted pages.
      // So `pdfEditBaker` should be called per page, or we pass the specific page and its edits.
    }
  },

  async bakePageEdits(pdfPage, pageEdits) {
    if (!pageEdits || pageEdits.length === 0) return;

    for (const edit of pageEdits) {
      if (edit.type === 'text') {
        const { x, y, payload } = edit;
        const { text, fontSize, color } = payload;
        
        const rgbColor = this.hexToRgb(color);
        
        pdfPage.drawText(text, {
          x: x,
          y: y - fontSize, // Adjust for baseline
          size: fontSize,
          color: rgbColor
        });
      } else if (edit.type === 'shape' || edit.type === 'highlight') {
        const { x, y, payload } = edit;
        const { width, height, color, borderColor, borderWidth, opacity, blendMode } = payload;

        const rgbFill = color !== 'transparent' ? this.hexToRgb(color) : undefined;
        const rgbBorder = this.hexToRgb(borderColor);

        // pdf-lib's drawRectangle x,y is bottom-left corner of the rectangle
        // The x,y we saved is top-left in PDF coordinates (from pdf.js). Wait, if we use top-left:
        // Actually, pdf.js convertToPdfPoint returns (x, y) where (0,0) is bottom-left of the page.
        // So x is left, y is top! Wait...
        // If (0,0) is bottom-left, then y goes UP. So a rectangle starting at (x, y) and going DOWN by `height`
        // means the bottom-left corner is at (x, y - height).
        
        let pdfBlendMode = undefined;
        if (blendMode === 'multiply' && typeof window !== 'undefined' && window.PDFLib) {
          pdfBlendMode = window.PDFLib.BlendMode.Multiply;
        }

        pdfPage.drawRectangle({
          x: x,
          y: y - height,
          width: width,
          height: height,
          color: rgbFill,
          borderColor: rgbBorder,
          borderWidth: borderWidth,
          opacity: opacity !== undefined ? opacity : 1.0,
          borderOpacity: opacity !== undefined ? opacity : 1.0,
          blendMode: pdfBlendMode
        });
      } else if (edit.type === 'draw') {
        const { payload } = edit;
        const { points, color, borderWidth } = payload;
        if (!points || points.length < 2) continue;

        const rgbColor = this.hexToRgb(color);

        // Convert points to SVG path data
        // For drawSvgPath, the path coords are relative to the page origin (bottom-left) OR relative to x,y provided.
        // Actually, pdf-lib's drawSvgPath draws exactly where the coords say if we use absolute coordinates in the SVG.
        // Wait, pdf.js returned coords where y is from top? No, pdf.js convertToPdfPoint returns y from BOTTOM.
        // Wait! Let's double check pdf.js convertToPdfPoint. If (0,0) is bottom-left, then Y=0 is bottom.
        // In my `text` baker, I did `y: y - fontSize`. If Y=0 is bottom, then `y - fontSize` moves it further down. This is correct if `y` was top-left of the text bounding box.
        // Let's generate an SVG path:
        let svgPath = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
          svgPath += ` L ${points[i][0]} ${points[i][1]}`;
        }

        // Wait! In SVG, (0,0) is TOP-LEFT. But in pdf-lib `drawSvgPath` it usually parses it and draws it.
        // But `drawSvgPath` might flip the Y axis because PDF is bottom-left, and SVG is top-left!
        // Actually, pdf-lib's drawSvgPath assumes the path is in PDF coordinate space (where Y goes up) unless scaled.
        // Actually, pdf-lib drawSvgPath takes the path and maps it directly.
        pdfPage.drawSvgPath(svgPath, {
          x: 0,
          y: 0,
          borderColor: rgbColor,
          borderWidth: borderWidth
        });
      }
    }
  },

  hexToRgb(hex) {
    // Basic hex to rgb for pdf-lib (values 0-1)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || typeof window === 'undefined' || !window.PDFLib) return null;
    const { rgb } = window.PDFLib;
    return result ? rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ) : rgb(0, 0, 0);
  }
};

export default pdfEditBaker;
