import editorStore from './editorStore.js';
import pdfEditBaker from './pdfEditBaker.js';

const exportHandler = {
  /**
   * Save the current PDF state (including baked edits) and trigger a download.
   */
  async exportPdf() {
    const state = editorStore.getState();
    if (!state.documentBytes) return;

    try {
      document.body.style.cursor = 'wait';
      const { PDFDocument } = window.PDFLib;
      
      const srcDoc = await PDFDocument.load(state.documentBytes);
      const newDoc = await PDFDocument.create();
      
      const copiedPages = await newDoc.copyPages(srcDoc, state.pageOrder);
      copiedPages.forEach((page, i) => {
        newDoc.addPage(page);
        const rotation = state.rotations[state.pageOrder[i]] || 0;
        if (rotation !== 0) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(window.PDFLib.degrees(currentRotation + rotation));
        }
      });
      
      // Filter deleted pages edits
      const activeEdits = state.edits.filter(e => !state.deletedPages.has(e.page));
      
      // We must group edits by their visual page index, because `newDoc.getPages()` corresponds to the current visual order.
      // E.g., if pageOrder is [3, 0], visual page 1 is original page index 3.
      // Wait, `e.page` stores the visual page at the time the edit was made.
      // Actually, my edits track `page` as displayIndex (1-based).
      // So visual page 1 has edits where `e.page === 1`.
      // The newly created doc's first page corresponds to visual page 1!
      // This is perfect!
      
      const pdfPages = newDoc.getPages();
      for (let i = 0; i < pdfPages.length; i++) {
        const visualPageNum = i + 1;
        const pageEdits = activeEdits.filter(e => e.page === visualPageNum);
        if (pageEdits.length > 0) {
          await pdfEditBaker.bakePageEdits(pdfPages[i], pageEdits);
        }
      }
      
      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      this.triggerDownload(blob, `edited_${state.fileName}`);
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("Failed to export PDF.");
    } finally {
      document.body.style.cursor = '';
    }
  },

  /**
   * Export each page of the PDF as an image and download as a ZIP archive.
   */
  async exportImages() {
    const state = editorStore.getState();
    if (!state.documentBytes) return;

    try {
      document.body.style.cursor = 'wait';
      const pdfjsLib = window['pdfjs-dist/build/pdf'];

      // Let's use the optimized approach:
      // 1. Bake to new PDF bytes
      // 2. Load with PDF.js
      // 3. Render to canvas -> toBlob -> JSZip
      const { PDFDocument } = window.PDFLib;
      const srcDoc = await PDFDocument.load(state.documentBytes);
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, state.pageOrder);
      copiedPages.forEach((p, i) => {
        newDoc.addPage(p);
        const rotation = state.rotations[state.pageOrder[i]] || 0;
        if (rotation !== 0) {
          p.setRotation(window.PDFLib.degrees(p.getRotation().angle + rotation));
        }
      });
      
      const activeEdits = state.edits.filter(e => !state.deletedPages.has(e.page));
      const pdfPages = newDoc.getPages();
      for (let i = 0; i < pdfPages.length; i++) {
        const pageEdits = activeEdits.filter(e => e.page === (i + 1));
        if (pageEdits.length > 0) {
          await pdfEditBaker.bakePageEdits(pdfPages[i], pageEdits);
        }
      }
      
      const finalBytes = await newDoc.save();
      const finalPdfJsDoc = await pdfjsLib.getDocument({ data: finalBytes }).promise;
      
      const zip = new JSZip();
      for (let i = 1; i <= finalPdfJsDoc.numPages; i++) {
        const page = await finalPdfJsDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        zip.file(`page_${i}.png`, blob);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      this.triggerDownload(zipBlob, `${state.fileName.replace('.pdf', '')}_images.zip`);
    } catch (err) {
      console.error("Failed to export images", err);
      alert("Failed to export images.");
    } finally {
      document.body.style.cursor = '';
    }
  },

  /**
   * Export the PDF text by extracting it using pdf.js.
   */
  async exportText() {
    const state = editorStore.getState();
    if (!state.documentBytes) return;

    try {
      document.body.style.cursor = 'wait';
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      const pdfJsDoc = await pdfjsLib.getDocument({ data: state.documentBytes }).promise;
      
      let fullText = '';
      
      for (let i = 0; i < state.pageOrder.length; i++) {
        const originalIndex = state.pageOrder[i];
        const page = await pdfJsDoc.getPage(originalIndex + 1);
        const textContent = await page.getTextContent();
        
        const pageString = textContent.items.map(item => item.str).join(' ');
        fullText += `--- Page ${i + 1} ---\n${pageString}\n\n`;
      }
      
      const blob = new Blob([fullText], { type: 'text/plain' });
      this.triggerDownload(blob, `${state.fileName.replace('.pdf', '')}_text.txt`);
    } catch (err) {
      console.error("Failed to export text", err);
      alert("Failed to export text.");
    } finally {
      document.body.style.cursor = '';
    }
  },

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

export default exportHandler;
