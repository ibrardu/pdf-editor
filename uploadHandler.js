/**
 * uploadHandler.js — Backend agent
 * Validates and processes PDF file uploads.
 * Calls editorStore.loadPdf() only via its public API.
 */
import editorStore from './editorStore.js';

const ALLOWED_MIME = 'application/pdf';
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const uploadHandler = {
  /**
   * Validate a File object before processing.
   * @param {File} file
   * @returns {{ valid: boolean, error: string|null }}
   */
  validateFile(file) {
    if (!file) {
      return { valid: false, error: 'No file selected.' };
    }
    const isPdf =
      file.type === ALLOWED_MIME ||
      file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return { valid: false, error: 'Only PDF files are accepted.' };
    }
    if (file.size === 0) {
      return { valid: false, error: 'File is empty.' };
    }
    if (file.size > MAX_SIZE_BYTES) {
      return {
        valid: false,
        error: `File exceeds the ${MAX_SIZE_BYTES / (1024 * 1024)} MB size limit.`,
      };
    }
    return { valid: true, error: null };
  },

  /**
   * Read a File object and load it into editorStore.
   * Throws on validation failure.
   * @param {File} file
   */
  async processFile(file) {
    const { valid, error } = this.validateFile(file);
    if (!valid) throw new Error(error);

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    await editorStore.loadPdf(bytes, file.name);
  },

  /**
   * Convert image files to a single PDF and load it.
   */
  async processImages(files) {
    if (!files || files.length === 0) return;
    
    document.body.style.cursor = 'wait';
    try {
      const { PDFDocument } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        let image;
        if (file.type === 'image/png') {
          image = await pdfDoc.embedPng(bytes);
        } else {
          image = await pdfDoc.embedJpg(bytes);
        }
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });
      }

      const pdfBytes = await pdfDoc.save();
      await editorStore.loadPdf(pdfBytes, 'images_converted.pdf');
    } finally {
      document.body.style.cursor = '';
    }
  },
};

export default uploadHandler;
