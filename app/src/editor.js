// editor.js — the Midnight Duo editor: photo slots, caption fields, layout
// and grade pickers, drag-to-pan / wheel-to-zoom per panel, undo/redo and
// PNG export. It owns the state object and redraws the cover through
// renderCover() from cover.js after every change.

import { GRADES, LAYOUTS, EXPORT_SIZES, defaultState, renderCover } from './cover.js';

export const PANEL_KEYS = ['hero', 'car', 'heli', 'dj', 'boat'];
export const PANEL_LABELS = { hero: 'Duo', car: 'Car', heli: 'Heli', dj: 'DJ', boat: 'Boat' };

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createEditor(canvas, photos, initialState) {
  const state = initialState || defaultState();
  let selected = 'hero';
  let past = [];
  let future = [];
  let drag = null;

  const $ = (id) => document.getElementById(id);
  const statusLine = $('statusLine');

  function draw() {
    renderCover(canvas, state, photos);
  }

  function setStatus(text) {
    if (statusLine) statusLine.textContent = text;
  }

  function commit(label) {
    past.push(cloneState(state));
    if (past.length > 60) past.shift();
    future = [];
    draw();
    refreshButtons();
    if (label) setStatus(label);
  }

  function undo() {
    if (!past.length) return;
    future.push(cloneState(state));
    Object.assign(state, past.pop());
    state.crops = state.crops || {};
    draw();
    refreshButtons();
    setStatus('Undone.');
  }

  function redo() {
    if (!future.length) return;
    past.push(cloneState(state));
    Object.assign(state, future.pop());
    draw();
    refreshButtons();
    setStatus('Redone.');
  }

  // --- photo slots -------------------------------------------------------
  const slotsEl = $('photoSlots');
  PANEL_KEYS.forEach((key) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.dataset.key = key;
    btn.title = PANEL_LABELS[key];
    const img = document.createElement('img');
    img.alt = PANEL_LABELS[key];
    img.src = `samples/${key === 'hero' ? 'duo' : key}.jpg`;
    const cap = document.createElement('span');
    cap.textContent = PANEL_LABELS[key];
    btn.append(img, cap);
    btn.addEventListener('click', () => {
      selected = key;
      refreshButtons();
      setStatus(`${PANEL_LABELS[key]} selected — drag on the cover to pan, scroll to zoom.`);
    });
    slotsEl.appendChild(btn);
  });

  // --- caption fields ----------------------------------------------------
  const textFields = [
    ['titleInput', 'title'],
    ['cityInput', 'city'],
    ['taglineInput', 'tagline'],
    ['sashInput', 'sash'],
  ];
  textFields.forEach(([id, field]) => {
    const input = $(id);
    if (!input) return;
    input.value = state[field];
    input.addEventListener('input', () => {
      state[field] = input.value.toUpperCase();
      draw();
    });
    input.addEventListener('change', () => commit('Caption updated.'));
  });

  const sashToggle = $('sashToggle');
  if (sashToggle) {
    sashToggle.checked = state.showSash;
    sashToggle.addEventListener('change', () => {
      past.push(cloneState(state));
      future = [];
      state.showSash = sashToggle.checked;
      draw();
      refreshButtons();
    });
  }

  const captionToggle = $('captionToggle');
  if (captionToggle) {
    captionToggle.checked = state.showCaptions;
    captionToggle.addEventListener('change', () => {
      past.push(cloneState(state));
      future = [];
      state.showCaptions = captionToggle.checked;
      draw();
      refreshButtons();
    });
  }

  // --- layout / grade / size pickers --------------------------------------
  function buildButtons(el, values, current, onPick, formatter) {
    if (!el) return;
    el.innerHTML = '';
    values.forEach((value) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = formatter ? formatter(value) : value;
      btn.classList.toggle('active', value === current);
      btn.addEventListener('click', () => onPick(value));
      el.appendChild(btn);
    });
  }

  function pickLayout(layout) {
    if (layout === state.layout) return;
    past.push(cloneState(state));
    future = [];
    state.layout = layout;
    draw();
    refreshButtons();
    setStatus(`Layout: ${layout}.`);
  }

  function pickGrade(grade) {
    if (grade === state.grade) return;
    past.push(cloneState(state));
    future = [];
    state.grade = grade;
    draw();
    refreshButtons();
    setStatus(`Grade: ${grade}.`);
  }

  let exportSize = EXPORT_SIZES[2];
  function pickSize(size) {
    exportSize = size;
    refreshButtons();
    setStatus(`Export size: ${size.label}.`);
  }

  // --- pan / zoom on the canvas -------------------------------------------
  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  // Which panel rect sits under a canvas point? Recomputed from the same
  // geometry renderCover uses (band layout, the editor's preview layout is
  // whatever the state says; for hit-testing we approximate with the band
  // geometry and the hero rect, which covers the common case).
  function panelAt(px, py) {
    const W = canvas.width;
    const H = canvas.height;
    const gap = Math.max(2, Math.round(W * 0.004));
    if (state.layout === 'band' && W > H) {
      const heroW = Math.round(W * 0.56);
      if (px < heroW) return 'hero';
      const gridX = heroW + gap;
      const cellW = (W - gridX - gap) / 2;
      const cellH = (H - gap * 3) / 2;
      const col = px < gridX + cellW + gap ? 0 : 1;
      const row = py < gap * 2 + cellH ? 0 : 1;
      return ['car', 'heli', 'dj', 'boat'][row * 2 + col];
    }
    if (state.layout === 'band') {
      const heroH = Math.round(H * 0.5);
      if (py < heroH) return 'hero';
      const gridY = heroH + gap;
      const cellW = (W - gap * 3) / 2;
      const cellH = (H - gridY - gap) / 2;
      const col = px < gap * 2 + cellW ? 0 : 1;
      const row = py < gridY + cellH + gap ? 0 : 1;
      return ['car', 'heli', 'dj', 'boat'][row * 2 + col];
    }
    return selected;
  }

  canvas.addEventListener('pointerdown', (event) => {
    const p = canvasPoint(event);
    selected = panelAt(p.x, p.y);
    const crop = state.crops[selected];
    drag = { key: selected, lastX: p.x, lastY: p.y, moved: false, start: { ...crop } };
    canvas.setPointerCapture(event.pointerId);
    refreshButtons();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = canvasPoint(event);
    const crop = state.crops[drag.key];
    const img = photos[drag.key];
    if (!img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const dx = (p.x - drag.lastX) / canvas.width;
    const dy = (p.y - drag.lastY) / canvas.height;
    crop.fx = Math.max(0, Math.min(1, crop.fx - dx * (canvas.width / iw)));
    crop.fy = Math.max(0, Math.min(1, crop.fy - dy * (canvas.height / ih)));
    drag.lastX = p.x;
    drag.lastY = p.y;
    if (Math.abs(dx) + Math.abs(dy) > 0) drag.moved = true;
    draw();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && drag.moved) {
      past.push({ ...cloneState(state), crops: JSON.parse(JSON.stringify(state.crops)) });
      // Replace the snapshot we just pushed with the pre-drag state: the
      // drag mutated crops in place, so rebuild the undo entry from the
      // drag start instead.
      const before = cloneState(state);
      before.crops[drag.key] = drag.start;
      past[past.length - 1] = before;
      future = [];
      refreshButtons();
      setStatus(`${PANEL_LABELS[drag.key]} reframed.`);
    }
    drag = null;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const crop = state.crops[selected];
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    crop.zoom = Math.max(1, Math.min(3, (crop.zoom || 1) * factor));
    draw();
  }, { passive: false });

  // --- upload --------------------------------------------------------------
  const uploadInput = $('uploadInput');
  if (uploadInput) {
    uploadInput.addEventListener('change', () => {
      const file = uploadInput.files && uploadInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          past.push(cloneState(state));
          future = [];
          photos[selected] = img;
          const slot = slotsEl.querySelector(`[data-key="${selected}"] img`);
          if (slot) slot.src = reader.result;
          state.crops[selected] = { fx: 0.5, fy: 0.5, zoom: 1 };
          draw();
          refreshButtons();
          setStatus(`Your photo is in the ${PANEL_LABELS[selected]} panel.`);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      uploadInput.value = '';
    });
  }

  // --- undo / redo / export --------------------------------------------------
  const undoBtn = $('undoBtn');
  const redoBtn = $('redoBtn');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  if (redoBtn) redoBtn.addEventListener('click', redo);

  function refreshButtons() {
    slotsEl.querySelectorAll('.slot').forEach((slot) => {
      slot.classList.toggle('active', slot.dataset.key === selected);
    });
    buildButtons($('layoutBtns'), LAYOUTS, state.layout, pickLayout);
    buildButtons($('gradeBtns'), GRADES, state.grade, pickGrade);
    buildButtons($('sizeBtns'), EXPORT_SIZES, exportSize, pickSize, (s) => s.label);
    if (undoBtn) undoBtn.disabled = past.length === 0;
    if (redoBtn) redoBtn.disabled = future.length === 0;
  }

  const exportBtn = $('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const out = document.createElement('canvas');
      out.width = exportSize.w;
      out.height = exportSize.h;
      renderCover(out, state, photos);
      out.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `midnight-duo-${exportSize.w}x${exportSize.h}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setStatus(`Exported ${exportSize.label} PNG.`);
      }, 'image/png');
    });
  }

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    }
  });

  refreshButtons();
  draw();
  return { state, draw, undo, redo, get selected() { return selected; } };
}
