/**
 * toolbarController.js — Backend agent
 * Manages toolbar logic: keyboard shortcuts, tool configuration.
 * Calls editorStore public methods only; never mutates state directly.
 */
import editorStore from './editorStore.js';

/** Tool → keyboard shortcut mapping */
const TOOL_SHORTCUTS = {
  v: 'select',
  t: 'text',
  d: 'draw',
  h: 'highlight',
  s: 'shape',
  i: 'image',
  w: 'whiteout',
};

/** Tool metadata for the UI layer */
const TOOL_CONFIG = {
  select:    { label: 'Select',    shortcut: 'V' },
  text:      { label: 'Text',      shortcut: 'T' },
  draw:      { label: 'Draw',      shortcut: 'D' },
  highlight: { label: 'Highlight', shortcut: 'H' },
  shape:     { label: 'Shape',     shortcut: 'S' },
  image:     { label: 'Image',     shortcut: 'I' },
  whiteout:  { label: 'Whiteout',  shortcut: 'W' },
};

const ZOOM_STEP = 0.25;

const toolbarController = {
  /**
   * Initialise keyboard shortcut listeners.
   * Call once after DOMContentLoaded.
   */
  init() {
    document.addEventListener('keydown', (e) => {
      // Ignore when focus is in an input or editable area
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Tool shortcuts (single key, no modifier)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          editorStore.setActiveTool(tool);
          return;
        }
      }

      // Zoom shortcuts  (Cmd/Ctrl + =/-/0)
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          editorStore.setZoom(editorStore.state.zoom + ZOOM_STEP);
        } else if (e.key === '-') {
          e.preventDefault();
          editorStore.setZoom(editorStore.state.zoom - ZOOM_STEP);
        } else if (e.key === '0') {
          e.preventDefault();
          editorStore.setZoom(1.0);
        }
      }
    });
  },

  /**
   * Return config for a given tool name.
   * @param {string} toolName
   * @returns {{ label: string, shortcut: string }|null}
   */
  getToolConfig(toolName) {
    return TOOL_CONFIG[toolName] || null;
  },

  /**
   * Return an array of all registered tool names.
   * @returns {string[]}
   */
  getToolNames() {
    return Object.keys(TOOL_CONFIG);
  },
};

export default toolbarController;
