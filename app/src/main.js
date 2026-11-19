// main.js — boot for the Midnight Duo cover maker.
//
// Two modes, picked from the URL:
//   editor (default) — the full editor: slots, caption fields, layout and
//     grade pickers, drag-to-pan, export.
//   ?shot=cover&size=WxH — the cover alone, filling the viewport, rendered
//     once with the sample photos (this is what the screenshots are taken
//     from; it sets data-shot-ready when the frame is drawn).
//   ?shot=editor&size=WxH — the editor with the duo loaded, for the
//     app-in-a-browser screenshot.

import { defaultState, renderCover } from './cover.js';
import { createEditor } from './editor.js';

const SAMPLES = ['hero', 'car', 'heli', 'dj', 'boat'];
const SAMPLE_FILE = { hero: 'duo', car: 'car', heli: 'heli', dj: 'dj', boat: 'boat' };

async function loadFont(name, url, weight) {
  try {
    const face = new FontFace(name, `url(${url})`, { weight: String(weight || 400) });
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    console.warn('font failed to load:', name, err);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function loadPhotos() {
  const photos = {};
  await Promise.all(SAMPLES.map(async (key) => {
    photos[key] = await loadImage(`samples/${SAMPLE_FILE[key]}.jpg`);
  }));
  return photos;
}

function parseSize(value, fallback) {
  const m = /^(\d+)x(\d+)$/.exec(value || '');
  if (!m) return fallback;
  return { w: Number(m[1]), h: Number(m[2]) };
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const canvas = document.getElementById('stage');

  await Promise.all([
    loadFont('Passion One', 'fonts/PassionOne.ttf'),
    loadFont('Anton', 'fonts/Anton-Regular.ttf'),
    document.fonts.ready,
  ]);
  const photos = await loadPhotos();
  const state = defaultState();
  const grade = params.get('grade');
  if (grade) state.grade = grade;
  const layout = params.get('layout');
  if (layout) state.layout = layout;

  if (shot === 'cover') {
    document.body.classList.add('shot');
    const size = parseSize(params.get('size'), { w: 1280, h: 720 });
    canvas.width = size.w;
    canvas.height = size.h;
    renderCover(canvas, state, photos);
    document.documentElement.dataset.shotReady = '1';
    return;
  }

  if (shot === 'editor') {
    const size = parseSize(params.get('size'), { w: 1280, h: 720 });
    canvas.width = size.w;
    canvas.height = size.h;
    createEditor(canvas, photos, state);
    document.documentElement.dataset.shotReady = '1';
    return;
  }

  createEditor(canvas, photos, state);
}

boot().catch((err) => {
  console.error(err);
  document.documentElement.dataset.shotError = String(err && err.message ? err.message : err);
});
