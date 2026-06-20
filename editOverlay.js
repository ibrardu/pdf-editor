/**
 * editOverlay.js — Frontend agent
 * Manages the overlay canvas for receiving pointer events and creating edits.
 */
import editorStore from './editorStore.js';
import editRenderer from './editRenderer.js';

let overlayCanvas, overlayCtx, uiContainer;
let currentViewport = null;

let activeInput = null;

const editOverlay = {
  init() {
    overlayCanvas = document.getElementById('overlay-canvas');
    if (!overlayCanvas) return;
    overlayCtx = overlayCanvas.getContext('2d');
    uiContainer = document.getElementById('overlay-ui');

    editorStore.subscribe(() => {
      this.render();
    });

    overlayCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
  },

  setViewport(viewport) {
    currentViewport = viewport;
    this.render();
  },

  render() {
    if (!currentViewport || !overlayCanvas) return;
    const { currentPage, edits } = editorStore.state;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    const pageEdits = edits.filter(e => e.page === currentPage);
    editRenderer.drawEdits(overlayCtx, pageEdits, currentViewport);

    // Draw active drawing
    if (this.isDrawingShape && this.activeShape) {
      editRenderer.drawShape(overlayCtx, this.activeShape, currentViewport);
    }
  },

  isDrawingShape: false,
  activeShape: null,

  handleMouseDown(e) {
    const { activeTool, currentPage } = editorStore.state;
    if (activeTool === 'select') return;

    if (e.target !== overlayCanvas) return;

    const rect = overlayCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!currentViewport) return;
    const [pdfX, pdfY] = currentViewport.convertToPdfPoint(x, y);

    if (activeTool === 'text') {
      this.startTextEntry(x, y, pdfX, pdfY, currentPage);
    } else if (activeTool === 'shape') {
      this.isDrawingShape = true;
      this.activeShape = {
        type: 'shape',
        page: currentPage,
        startX: pdfX,
        startY: pdfY,
        x: pdfX,
        y: pdfY,
        payload: {
          width: 0,
          height: 0,
          color: 'transparent',
          borderColor: '#4f46e5',
          borderWidth: 2
        }
      };
    }
  },

  handleMouseMove(e) {
    if (this.isDrawingShape && this.activeShape && currentViewport) {
      const rect = overlayCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const [pdfX, pdfY] = currentViewport.convertToPdfPoint(x, y);
      
      this.activeShape.payload.width = pdfX - this.activeShape.startX;
      this.activeShape.payload.height = pdfY - this.activeShape.startY;
      
      // Keep x,y as top-left (or starting corner), width/height can be negative during drawing,
      // but let's normalize them on mouseup or in renderer.
      this.render();
    }
  },

  handleMouseUp(e) {
    if (this.isDrawingShape && this.activeShape) {
      this.isDrawingShape = false;
      // Normalize width/height and x/y
      let { startX, startY } = this.activeShape;
      let { width, height } = this.activeShape.payload;

      if (width < 0) { startX += width; width = Math.abs(width); }
      if (height < 0) { startY += height; height = Math.abs(height); }

      if (width > 5 && height > 5) {
        editorStore.addEdit({
          type: 'shape',
          page: this.activeShape.page,
          x: startX,
          y: startY,
          payload: {
            ...this.activeShape.payload,
            width,
            height
          }
        });
      }
      this.activeShape = null;
      this.render();
    }
  },

  startTextEntry(x, y, pdfX, pdfY, page) {
    if (activeInput) {
      this.commitTextEntry();
    }

    const input = document.createElement('textarea');
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.minWidth = '150px';
    input.style.minHeight = '30px';
    input.style.fontSize = '16px';
    input.style.fontFamily = 'Helvetica, Arial, sans-serif';
    input.style.background = 'transparent';
    input.style.border = '1px dashed var(--accent)';
    input.style.outline = 'none';
    input.style.resize = 'both';
    input.style.color = '#000';
    input.style.overflow = 'hidden';
    input.style.lineHeight = '1.2';
    
    uiContainer.appendChild(input);
    input.focus();

    activeInput = { input, pdfX, pdfY, page };

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (activeInput && activeInput.input === input) {
          this.commitTextEntry();
        }
      }, 100);
    });
  },

  commitTextEntry() {
    if (!activeInput) return;
    const { input, pdfX, pdfY, page } = activeInput;
    const text = input.value.trim();
    if (text) {
      // Calculate font size in PDF points.
      // 16px in screen pixels -> pdf scale. We can just store PDF points.
      // If scale is 1, 1px = 1pt approx in pdf.js (pdf.js uses 96dpi so 1pt = 1/72in = 1.33px, wait. pdf.js default scale 1 is 72dpi. So 1 CSS px = 1 PDF pt).
      // Let's store fontSize as 16 / currentViewport.scale to keep it consistent.
      const scale = currentViewport.scale;
      const fontSizePt = 16 / scale;

      editorStore.addEdit({
        type: 'text',
        page,
        x: pdfX,
        y: pdfY,
        payload: {
          text,
          fontSize: fontSizePt,
          color: '#000000',
          fontFamily: 'Helvetica'
        }
      });
    }
    input.remove();
    activeInput = null;
  }
};

export default editOverlay;
