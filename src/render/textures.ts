import * as THREE from 'three';

// Procedural canvas textures, so the game needs no image assets.
// Colours are sampled by eye from the reference photos in docs/images.

export const COLORS = {
  felt: '#067a50',
  feltDark: '#077552',
  railWood: '#968b84',
  railGrain: '#6d635d',
  bodyWood: '#4a3428',
  bodyGrain: '#2a1b13',
  plastic: '#151515',
  floor: '#ecd9cf',
  cloth: '#a8cbbd',
  cueBall: '#f3f1e7',
};

/** Toy-set ball colours: peach, teal blue, red, navy, orange, teal green, crimson, black. */
export const BALL_COLORS: Record<number, string> = {
  1: '#f2a47c',
  2: '#1e6e8c',
  3: '#e1342c',
  4: '#33306b',
  5: '#f2622f',
  6: '#0e7e67',
  7: '#c2252f',
  8: '#141414',
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finish(c: HTMLCanvasElement, repeat = true, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Felt: speckled fuzz with the fine ribbing seen on the toy's cloth. */
export function feltTexture(): THREE.CanvasTexture {
  const size = 512;
  const [c, g] = canvas(size, size);
  g.fillStyle = COLORS.felt;
  g.fillRect(0, 0, size, size);
  const r = rand(7);
  // Ribs
  for (let y = 0; y < size; y += 4) {
    g.fillStyle = `rgba(0,40,20,${0.05 + r() * 0.05})`;
    g.fillRect(0, y, size, 1.5);
  }
  // Fuzz
  for (let i = 0; i < 26000; i++) {
    const x = r() * size;
    const y = r() * size;
    const light = r() > 0.5;
    g.fillStyle = light ? `rgba(80,200,150,${r() * 0.18})` : `rgba(0,30,15,${r() * 0.22})`;
    g.fillRect(x, y, 1 + r() * 1.5, 1);
  }
  return finish(c);
}

/** Wood-grain laminate: long streaks with gentle waves. */
export function woodTexture(base: string, grain: string, seed: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const [c, g] = canvas(w, h);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const r = rand(seed);
  for (let i = 0; i < 220; i++) {
    const y0 = r() * h;
    const amp = 1 + r() * 4;
    const freq = 0.002 + r() * 0.01;
    const phase = r() * 10;
    g.strokeStyle = grain;
    g.globalAlpha = 0.08 + r() * 0.25;
    g.lineWidth = 0.5 + r() * 2;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  // A few lighter streaks.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.06})`;
    g.fillRect(0, r() * h, w, 1 + r() * 3);
  }
  return finish(c);
}

/** Pale wooden floor planks, as in the photos. */
export function floorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const [c, g] = canvas(size, size);
  const r = rand(21);
  const rows = 6;
  const ph = size / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 400;
    while (x < size) {
      const len = 380 + r() * 300;
      const shade = 225 + r() * 18;
      g.fillStyle = `rgb(${shade + 10},${shade - 6},${shade - 16})`;
      g.fillRect(x, row * ph, len, ph);
      for (let i = 0; i < 18; i++) {
        g.fillStyle = `rgba(150,110,90,${r() * 0.07})`;
        g.fillRect(x, row * ph + r() * ph, len, 1 + r() * 2);
      }
      g.fillStyle = 'rgba(120,90,80,0.35)';
      g.fillRect(x, row * ph, 2, ph);
      x += len;
    }
    g.fillStyle = 'rgba(120,90,80,0.35)';
    g.fillRect(0, row * ph, size, 2);
  }
  return finish(c);
}

/** Sage table cloth with the faint woven check from the photos. */
export function clothTexture(): THREE.CanvasTexture {
  const size = 256;
  const [c, g] = canvas(size, size);
  g.fillStyle = COLORS.cloth;
  g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < size; i += 32) {
    g.fillRect(i, 0, 14, size);
    g.fillRect(0, i, size, 14);
  }
  const r = rand(5);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(40,80,60,${r() * 0.06})`;
    g.fillRect(r() * size, r() * size, 1, 1);
  }
  return finish(c);
}

/**
 * Equirectangular ball texture: a solid colour, or white with a colour band for stripes.
 * The number sits in a white circle on each side.
 */
export function ballTexture(num: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const [c, g] = canvas(w, h);
  if (num === 0) {
    g.fillStyle = COLORS.cueBall;
    g.fillRect(0, 0, w, h);
    return finish(c, false);
  }
  const stripe = num > 8;
  const color = BALL_COLORS[stripe ? num - 8 : num];
  if (stripe) {
    g.fillStyle = '#f6f4ec';
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.fillRect(0, h * 0.3, w, h * 0.4);
  } else {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
  }
  for (const cx of [w * 0.25, w * 0.75]) {
    const cy = h / 2;
    const rad = h * 0.13;
    g.fillStyle = '#fbfaf5';
    g.beginPath();
    g.ellipse(cx, cy, rad, rad, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.font = `bold ${num > 9 ? h * 0.13 : h * 0.16}px Arial, Helvetica, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(num), cx, cy + h * 0.005);
    if (num === 6 || num === 9) g.fillRect(cx - h * 0.04, cy + h * 0.075, h * 0.08, h * 0.012);
  }
  return finish(c, false);
}
