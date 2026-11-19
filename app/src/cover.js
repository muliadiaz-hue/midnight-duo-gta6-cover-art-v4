// cover.js — draws a "Midnight Duo" GTA-style cover onto a canvas.
//
// The cover is a band poster: one big hero photo of the duo plus four small
// panels (car, heli, dj, boat), bold caption lettering over the hero's lower
// third, and a diagonal magenta sash. Everything is drawn from a plain state
// object, so the editor, the export and the screenshot mode all share this
// one renderer. Rendering is deterministic: the only randomness is film
// grain from a fixed-seed generator, and the photographic grade leaves the
// photos pixel-untouched.

export const GRADES = ['photo', 'poster', 'sunset', 'neon', 'golden', 'dusk', 'mono'];
export const LAYOUTS = ['band', 'hero', 'nine', 'diptych', 'strip'];
export const EXPORT_SIZES = [
  { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
  { label: 'Story 1080 × 1920', w: 1080, h: 1920 },
];

export const DEFAULT_CROPS = {
  hero: { fx: 0.35, fy: 0.48, zoom: 1.13 },
  car: { fx: 0.5, fy: 0.58, zoom: 1.0 },
  heli: { fx: 0.5, fy: 0.45, zoom: 1.0 },
  dj: { fx: 0.42, fy: 0.35, zoom: 1.0 },
  boat: { fx: 0.5, fy: 0.55, zoom: 1.0 },
};

export function defaultState() {
  return {
    layout: 'band',
    grade: 'photo',
    title: 'MIDNIGHT DUO',
    city: 'AZURA BAY',
    tagline: 'TWO LEADS · ONE SCORE',
    sash: 'ONE NIGHT ONLY',
    showSash: true,
    showCaptions: false,
    captions: { car: 'NIGHT DRIVE', heli: 'EYE IN THE SKY', dj: 'BEACH SET', boat: 'LAST BOAT OUT' },
    crops: JSON.parse(JSON.stringify(DEFAULT_CROPS)),
  };
}

// A tiny deterministic PRNG (mulberry32) so the film grain is identical on
// every run, in every browser.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 128; tile.height = 128;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(128, 128);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 28;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

// Cover-fit a source image into a box, anchored on a focal point (fx, fy in
// 0..1 of the source) and magnified by zoom. Returns the source rectangle to
// draw. The window is clamped inside the image so faces never slide out.
export function fitWindow(img, w, h, crop) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(w / iw, h / ih);
  const scale = base * (crop.zoom || 1);
  let sw = w / scale;
  let sh = h / scale;
  if (sw > iw) { sw = iw; sh = (iw * h) / w; }
  if (sh > ih) { sh = ih; sw = (ih * w) / h; }
  let sx = (crop.fx ?? 0.5) * iw - sw / 2;
  let sy = (crop.fy ?? 0.5) * ih - sh / 2;
  sx = Math.max(0, Math.min(iw - sw, sx));
  sy = Math.max(0, Math.min(ih - sh, sy));
  return { sx, sy, sw, sh };
}

function paintGrade(ctx, img, x, y, w, h, grade) {
  if (grade === 'photo' || !img) {
    if (img) ctx.drawImage(img, x, y, w, h);
    return;
  }
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const o = off.getContext('2d');
  const filters = {
    poster: 'saturate(1.28) contrast(1.08)',
    sunset: 'saturate(1.35) contrast(1.05)',
    neon: 'saturate(1.6) contrast(1.12)',
    golden: 'sepia(0.45) saturate(1.3) contrast(1.04)',
    dusk: 'saturate(0.85) brightness(0.92) contrast(1.06)',
    mono: 'grayscale(1) contrast(1.12)',
  };
  o.filter = filters[grade] || 'none';
  o.drawImage(img, 0, 0, off.width, off.height);
  o.filter = 'none';
  if (grade === 'sunset') {
    const g = o.createLinearGradient(0, 0, 0, off.height);
    g.addColorStop(0, 'rgba(255,122,26,0.10)');
    g.addColorStop(1, 'rgba(224,33,138,0.22)');
    o.fillStyle = g; o.fillRect(0, 0, off.width, off.height);
  } else if (grade === 'neon') {
    const g = o.createLinearGradient(0, 0, off.width, off.height);
    g.addColorStop(0, 'rgba(255,0,128,0.12)');
    g.addColorStop(1, 'rgba(0,229,255,0.12)');
    o.fillStyle = g; o.fillRect(0, 0, off.width, off.height);
  } else if (grade === 'golden') {
    o.fillStyle = 'rgba(255,176,66,0.10)';
    o.fillRect(0, 0, off.width, off.height);
  } else if (grade === 'dusk') {
    o.fillStyle = 'rgba(24,32,96,0.18)';
    o.fillRect(0, 0, off.width, off.height);
  }
  o.fillStyle = grainPattern(o);
  o.fillRect(0, 0, off.width, off.height);
  const vig = o.createRadialGradient(
    off.width / 2, off.height / 2, Math.min(off.width, off.height) * 0.45,
    off.width / 2, off.height / 2, Math.max(off.width, off.height) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  o.fillStyle = vig;
  o.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(off, x, y, w, h);
}

function paintPhoto(ctx, img, x, y, w, h, crop, grade) {
  if (!img) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const win = fitWindow(img, w, h, crop);
  if (grade === 'photo') {
    ctx.drawImage(img, win.sx, win.sy, win.sw, win.sh, x, y, w, h);
    return;
  }
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const o = off.getContext('2d');
  o.drawImage(img, win.sx, win.sy, win.sw, win.sh, 0, 0, off.width, off.height);
  paintGrade(o, off, 0, 0, off.width, off.height, grade);
  ctx.drawImage(off, x, y, w, h);
}

function drawFiveStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function fitFont(ctx, text, family, weight, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size *= 0.94;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

// The hero lettering: city line with drawn stars, the one-line gradient
// title with a heavy ink outline, and the yellow tagline. All sizes derive
// from the hero rectangle so the block scales with the export size.
export function drawHeroLettering(ctx, hero, state) {
  const { x, y, w, h } = hero;
  const pad = w * 0.055;
  // Soft dark scrim over the hero's lower third so the lettering reads.
  const scrim = ctx.createLinearGradient(0, y + h * 0.58, 0, y + h);
  scrim.addColorStop(0, 'rgba(8,3,20,0)');
  scrim.addColorStop(1, 'rgba(8,3,20,0.62)');
  ctx.fillStyle = scrim;
  ctx.fillRect(x, y + h * 0.58, w, h * 0.42);

  // City line: ★ AZURA BAY ★ in letterspaced Anton.
  const citySize = Math.max(10, h * 0.042);
  ctx.font = `400 ${citySize}px Anton, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${(w * 0.018).toFixed(1)}px`; } catch { /* older canvas */ }
  const cityW = ctx.measureText(state.city).width;
  const starR = citySize * 0.42;
  const cityX = x + (w - cityW) / 2;
  const cityY = y + h * 0.715;
  ctx.textAlign = 'left';
  ctx.fillText(state.city, cityX, cityY);
  drawFiveStar(ctx, cityX - starR * 2.1, cityY, starR);
  drawFiveStar(ctx, cityX + cityW + starR * 2.1, cityY, starR);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }

  // Title: one line, Passion One, sunset gradient, ink outline. The outline
  // is stroked first at the same size the fill is measured at, so the two
  // never drift apart (letterSpacing is zero here by construction).
  const titleTop = y + h * 0.755;
  const titleH = h * 0.155;
  const titleSize = fitFont(ctx, state.title, '"Passion One", sans-serif', 400, w - pad * 2, titleH * 1.35);
  const titleY = titleTop + titleH * 0.78;
  const grad = ctx.createLinearGradient(0, titleTop, 0, titleTop + titleH);
  grad.addColorStop(0, '#7b2ff7');
  grad.addColorStop(0.52, '#e0218a');
  grad.addColorStop(1, '#ff9a3d');
  ctx.font = `400 ${titleSize}px "Passion One", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = '#160a2b';
  ctx.lineWidth = Math.max(2, titleSize * 0.14);
  ctx.strokeText(state.title, x + pad, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(state.title, x + pad, titleY);

  // Tagline in yellow Anton.
  const tagSize = Math.max(9, h * 0.032);
  ctx.font = `400 ${tagSize}px Anton, sans-serif`;
  ctx.fillStyle = '#ffd94a';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${(w * 0.012).toFixed(1)}px`; } catch { /* older canvas */ }
  const tagW = ctx.measureText(state.tagline).width;
  ctx.textAlign = 'left';
  ctx.fillText(state.tagline, x + (w - tagW) / 2, y + h * 0.955);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

export function drawSash(ctx, hero, sashText) {
  const { x, y, w, h } = hero;
  ctx.save();
  ctx.translate(x + w * 0.13, y + h * 0.075);
  ctx.rotate(-0.55);
  const bw = w * 0.46;
  const bh = Math.max(14, h * 0.052);
  ctx.fillStyle = '#e0218a';
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#ffffff';
  const size = fitFont(ctx, sashText, 'Anton, sans-serif', 400, bw * 0.92, bh * 0.62);
  ctx.font = `400 ${size}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sashText, 0, 1);
  ctx.restore();
}

function drawCaptionTile(ctx, rect, text, grade) {
  ctx.fillStyle = '#e0218a';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = '#ffffff';
  const size = fitFont(ctx, text, 'Anton, sans-serif', 400, rect.w * 0.86, rect.h * 0.2);
  ctx.font = `400 ${size}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function panelCaption(ctx, rect, text) {
  if (!text) return;
  const size = Math.max(8, rect.h * 0.085);
  ctx.font = `400 ${size}px Anton, sans-serif`;
  const tw = ctx.measureText(text).width + size * 1.1;
  ctx.fillStyle = 'rgba(8,3,20,0.72)';
  ctx.fillRect(rect.x, rect.y + rect.h - size * 1.9, tw, size * 1.9);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rect.x + size * 0.55, rect.y + rect.h - size * 0.95);
}

// Geometry for the default band layout: hero on the left in landscape,
// hero on top in portrait/square, four panels in a 2x2 grid beside it.
function bandGeometry(W, H, gap) {
  const wide = W > H;
  if (wide) {
    const heroW = Math.round(W * 0.56);
    const gridX = heroW + gap;
    const cellW = (W - gridX - gap) / 2;
    const cellH = (H - gap * 3) / 2;
    return {
      hero: { x: 0, y: 0, w: heroW, h: H },
      cells: [
        { x: gridX, y: gap, w: cellW, h: cellH },
        { x: gridX + cellW + gap, y: gap, w: cellW, h: cellH },
        { x: gridX, y: gap * 2 + cellH, w: cellW, h: cellH },
        { x: gridX + cellW + gap, y: gap * 2 + cellH, w: cellW, h: cellH },
      ],
    };
  }
  const heroH = Math.round(H * 0.5);
  const gridY = heroH + gap;
  const cellW = (W - gap * 3) / 2;
  const cellH = (H - gridY - gap) / 2;
  return {
    hero: { x: 0, y: 0, w: W, h: heroH },
    cells: [
      { x: gap, y: gridY, w: cellW, h: cellH },
      { x: gap * 2 + cellW, y: gridY, w: cellW, h: cellH },
      { x: gap, y: gridY + cellH + gap, w: cellW, h: cellH },
      { x: gap * 2 + cellW, y: gridY + cellH + gap, w: cellW, h: cellH },
    ],
  };
}

export function renderCover(canvas, state, photos) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const gap = Math.max(2, Math.round(W * 0.004));
  ctx.fillStyle = '#0b0714';
  ctx.fillRect(0, 0, W, H);
  const order = ['car', 'heli', 'dj', 'boat'];
  const showCaptions = state.showCaptions && state.layout !== 'band';

  if (state.layout === 'hero') {
    const hero = { x: 0, y: 0, w: W, h: H };
    paintPhoto(ctx, photos.hero, 0, 0, W, H, state.crops.hero, state.grade);
    drawHeroLettering(ctx, hero, state);
    if (state.showSash) drawSash(ctx, hero, state.sash);
    return;
  }

  if (state.layout === 'diptych') {
    const half = Math.round(W / 2);
    paintPhoto(ctx, photos.hero, 0, 0, half - gap, H, state.crops.hero, state.grade);
    paintPhoto(ctx, photos.car, half + gap, 0, W - half - gap, H, state.crops.car, state.grade);
    const hero = { x: 0, y: 0, w: half - gap, h: H };
    drawHeroLettering(ctx, hero, state);
    if (state.showSash) drawSash(ctx, hero, state.sash);
    if (showCaptions) panelCaption(ctx, { x: half + gap, y: 0, w: W - half - gap, h: H }, state.captions.car);
    return;
  }

  if (state.layout === 'strip') {
    const heroH = Math.round(H * 0.66);
    paintPhoto(ctx, photos.hero, 0, 0, W, heroH, state.crops.hero, state.grade);
    const hero = { x: 0, y: 0, w: W, h: heroH };
    drawHeroLettering(ctx, hero, state);
    if (state.showSash) drawSash(ctx, hero, state.sash);
    const cellW = (W - gap * 5) / 4;
    const cellH = H - heroH - gap * 2;
    order.forEach((key, i) => {
      const rect = { x: gap + i * (cellW + gap), y: heroH + gap, w: cellW, h: cellH };
      paintPhoto(ctx, photos[key], rect.x, rect.y, rect.w, rect.h, state.crops[key], state.grade);
      if (showCaptions) panelCaption(ctx, rect, state.captions[key]);
    });
    return;
  }

  if (state.layout === 'nine') {
    const cellW = (W - gap * 4) / 3;
    const cellH = (H - gap * 4) / 3;
    const hero = { x: gap, y: gap, w: cellW * 2 + gap, h: cellH * 2 + gap };
    paintPhoto(ctx, photos.hero, hero.x, hero.y, hero.w, hero.h, state.crops.hero, state.grade);
    drawHeroLettering(ctx, hero, state);
    if (state.showSash) drawSash(ctx, hero, state.sash);
    const spots = [
      { x: gap * 3 + cellW * 2, y: gap, key: 'car' },
      { x: gap * 3 + cellW * 2, y: gap * 2 + cellH, key: 'heli' },
      { x: gap, y: gap * 3 + cellH * 2, key: 'dj' },
      { x: gap * 2 + cellW, y: gap * 3 + cellH * 2, key: 'boat' },
    ];
    spots.forEach((s) => {
      const rect = { x: s.x, y: s.y, w: cellW, h: cellH };
      paintPhoto(ctx, photos[s.key], rect.x, rect.y, rect.w, rect.h, state.crops[s.key], state.grade);
      if (showCaptions) panelCaption(ctx, rect, state.captions[s.key]);
    });
    drawCaptionTile(ctx, { x: gap * 3 + cellW * 2, y: gap * 3 + cellH * 2, w: cellW, h: cellH }, state.city, state.grade);
    return;
  }

  // band (default)
  const geo = bandGeometry(W, H, gap);
  paintPhoto(ctx, photos.hero, geo.hero.x, geo.hero.y, geo.hero.w, geo.hero.h, state.crops.hero, state.grade);
  order.forEach((key, i) => {
    const rect = geo.cells[i];
    paintPhoto(ctx, photos[key], rect.x, rect.y, rect.w, rect.h, state.crops[key], state.grade);
  });
  drawHeroLettering(ctx, geo.hero, state);
  if (state.showSash) drawSash(ctx, geo.hero, state.sash);
}
