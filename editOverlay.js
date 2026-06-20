/**
 * editOverlay.js — Frontend agent
 * Manages the overlay canvas for receiving pointer events and creating edits.
 */
import editorStore from './editorStore.js';
import editRenderer from './editRenderer.js';

let overlayCanvas, overlayCtx, uiContainer;
let currentViewport = null;

let activeInput = null;
let pendingImageDataUrl = null;

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

  setPendingImage(dataUrl) {
    pendingImageDataUrl = dataUrl;
    editorStore.setActiveTool('image');
  },

  render() {
    if (!currentViewport || !overlayCanvas) return;
    const { currentPage, edits } = editorStore.state;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    const pageEdits = edits.filter(e => e.page === currentPage);
    editRenderer.drawEdits(overlayCtx, pageEdits, currentViewport);

    // Draw active shape or path
    if (this.isDrawingShape && this.activeShape) {
      if (this.activeShape.type === 'shape' || this.activeShape.type === 'highlight' || this.activeShape.type === 'whiteout' || this.activeShape.type === 'edit-text') {
        editRenderer.drawShape(overlayCtx, this.activeShape, currentViewport);
      } else if (this.activeShape.type === 'draw') {
        editRenderer.drawPath(overlayCtx, this.activeShape, currentViewport);
      }
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

    if (activeTool === 'text' || activeTool === 'note') {
      if (activeInput) {
        // user clicked elsewhere, just commit current
        this.commitTextEntry();
        // and optionally reset tool:
        editorStore.setActiveTool('select');
        return;
      }
      this.startTextEntry(x, y, pdfX, pdfY, currentPage, '', activeTool === 'note');
    } else if (activeTool === 'image' && pendingImageDataUrl) {
      this.placeImage(pdfX, pdfY, pendingImageDataUrl, currentPage);
    } else if (activeTool === 'shape' || activeTool === 'highlight' || activeTool === 'whiteout' || activeTool === 'edit-text') {
      this.isDrawingShape = true;

      let color = 'transparent';
      let borderColor = '#4f46e5';
      let borderWidth = 2;
      let opacity = 1.0;
      let blendMode = 'normal';

      if (activeTool === 'highlight') {
        color = '#ffff00';
        borderColor = 'transparent';
        borderWidth = 0;
        opacity = 0.5;
        blendMode = 'multiply';
      } else if (activeTool === 'whiteout') {
        color = '#ffffff';
        borderColor = 'transparent';
        borderWidth = 0;
      } else if (activeTool === 'edit-text') {
        color = 'rgba(0, 150, 255, 0.1)';
        borderColor = '#0096ff';
        borderWidth = 1;
      }

      this.activeShape = {
        type: activeTool,
        page: currentPage,
        startX: pdfX,
        startY: pdfY,
        x: pdfX,
        y: pdfY,
        payload: {
          width: 0,
          height: 0,
          color,
          borderColor,
          borderWidth,
          opacity,
          blendMode
        }
      };
    } else if (activeTool === 'draw') {
      this.isDrawingShape = true;
      this.activeShape = {
        type: 'draw',
        page: currentPage,
        payload: {
          points: [[pdfX, pdfY]], // array of [x, y] in PDF coords
          color: '#4f46e5',
          borderWidth: 3
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
      
      if (this.activeShape.type === 'shape' || this.activeShape.type === 'highlight' || this.activeShape.type === 'whiteout' || this.activeShape.type === 'edit-text') {
        this.activeShape.payload.width = pdfX - this.activeShape.startX;
        this.activeShape.payload.height = pdfY - this.activeShape.startY;
      } else if (this.activeShape.type === 'draw') {
        this.activeShape.payload.points.push([pdfX, pdfY]);
      }
      
      this.render();
    }
  },

  handleMouseUp(e) {
    if (this.isDrawingShape && this.activeShape) {
      this.isDrawingShape = false;
      
      if (this.activeShape.type === 'shape' || this.activeShape.type === 'highlight' || this.activeShape.type === 'whiteout' || this.activeShape.type === 'edit-text') {
        // Normalize width/height and x/y
        let { startX, startY } = this.activeShape;
        let { width, height } = this.activeShape.payload;

        if (width < 0) { startX += width; width = Math.abs(width); }
        if (height < 0) { startY += height; height = Math.abs(height); }

        if (width > 5 && height > 5) {
          if (this.activeShape.type === 'edit-text') {
            this.handleEditTextBox(startX, startY, width, height, this.activeShape.page);
          } else {
            editorStore.addEdit({
              type: this.activeShape.type,
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
        }
      } else if (this.activeShape.type === 'draw') {
        if (this.activeShape.payload.points.length > 2) {
          editorStore.addEdit({
            type: 'draw',
            page: this.activeShape.page,
            payload: this.activeShape.payload
          });
        }
      }
      this.activeShape = null;
      this.render();
    }
  },

  startTextEntry(x, y, pdfX, pdfY, page, initialText = '', isNote = false) {
    if (activeInput) {
      this.commitTextEntry();
    }

    const input = document.createElement('textarea');
    input.value = initialText;
    input.style.position = 'absolute';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.border = '1px solid #4f46e5';
    input.style.padding = '4px';
    input.style.minWidth = '100px';
    input.style.minHeight = '40px';
    input.style.fontSize = '16px'; // screen size
    input.style.fontFamily = 'Helvetica, Arial, sans-serif';
    input.style.zIndex = 1000;
    input.style.resize = 'both';
    
    if (isNote) {
      input.dataset.isNote = 'true';
      input.style.backgroundColor = '#fff9c4'; // Yellow note background
      input.style.border = '1px solid #fbc02d';
      input.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
    }

    input.dataset.pdfX = pdfX;
    input.dataset.pdfY = pdfY;
    input.dataset.page = page;

    document.getElementById('canvas-wrapper').appendChild(input);
    input.focus();
    activeInput = input;
  },

  commitTextEntry() {
    if (!activeInput) return;
    const text = activeInput.value.trim();
    if (text) {
      const page = parseInt(activeInput.dataset.page, 10);
      const pdfX = parseFloat(activeInput.dataset.pdfX);
      const pdfY = parseFloat(activeInput.dataset.pdfY);
      const isNote = activeInput.dataset.isNote === 'true';
      
      const scale = currentViewport ? currentViewport.scale : 1;
      const rect = activeInput.getBoundingClientRect();
      const pdfWidth = rect.width / scale;
      const pdfHeight = rect.height / scale;

      editorStore.addEdit({
        type: isNote ? 'note' : 'text',
        page,
        x: pdfX,
        y: pdfY,
        payload: {
          text,
          fontSize: 16 / scale,
          color: '#000000',
          width: pdfWidth,
          height: pdfHeight
        }
      });
    }

    if (activeInput.parentNode) {
      activeInput.parentNode.removeChild(activeInput);
    }
    activeInput = null;
  },

  async handleEditTextBox(pdfX, pdfY, width, height, page) {
    if (!currentViewport) return;
    
    const [screenX, screenY] = currentViewport.convertToViewportPoint(pdfX, pdfY);
    const [screenX2, screenY2] = currentViewport.convertToViewportPoint(pdfX + width, pdfY + height);
    
    const sWidth = Math.abs(screenX2 - screenX);
    const sHeight = Math.abs(screenY2 - screenY);
    const sX = Math.min(screenX, screenX2);
    const sY = Math.min(screenY, screenY2);
    
    const pdfCanvas = document.getElementById('pdf-canvas');
    if (!pdfCanvas) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sWidth;
    tempCanvas.height = sHeight;
    const tCtx = tempCanvas.getContext('2d');
    
    tCtx.drawImage(pdfCanvas, sX, sY, sWidth, sHeight, 0, 0, sWidth, sHeight);
    const dataUrl = tempCanvas.toDataURL('image/png');
    
    document.body.style.cursor = 'wait';
    try {
      // Assuming Tesseract is loaded globally via CDN
      const result = await Tesseract.recognize(dataUrl, 'eng');
      const text = result.data.text.trim();
      
      // Auto-add whiteout edit to hide original text
      editorStore.addEdit({
        type: 'whiteout',
        page: page,
        x: pdfX,
        y: pdfY,
        payload: {
          width: width,
          height: height,
          color: '#ffffff',
          borderColor: 'transparent',
          borderWidth: 0
        }
      });
      
      // Switch tool to text and spawn text entry
      editorStore.setActiveTool('text');
      this.startTextEntry(sX, sY, pdfX, pdfY, page, text);
    } catch (err) {
      console.error("OCR Failed:", err);
      alert("Failed to read text. Please try again.");
    } finally {
      document.body.style.cursor = '';
    }
  },

  placeImage(pdfX, pdfY, dataUrl, page) {
    // Determine image dimensions
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Scale down if it's too large
      const maxDim = 300;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio;
        height *= ratio;
      }

      editorStore.addEdit({
        type: 'image',
        page,
        x: pdfX,
        y: pdfY,
        payload: {
          dataUrl,
          width,
          height
        }
      });
      pendingImageDataUrl = null;
      editorStore.setActiveTool('select');
    };
    img.src = dataUrl;
  }
};

export default editOverlay;
