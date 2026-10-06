export interface Swatch {
  /** CSS colour for the spine. */
  css: string;
  /** Ink or paper for the title, whichever reads better on it. */
  text: string;
}

const INK = "#2b231d";
const PAPER = "#f4ecdc";
const FALLBACK: Swatch = { css: "#d5c6ab", text: INK };

// Colours within this many levels per channel count as the same colour.
const BIN = 24;

/** Ink or paper, whichever reads better on the colour. */
function textOn(r: number, g: number, b: number) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.22 ? INK : PAPER;
}

/** A hand-picked spine colour from site.json. */
export function fixedSwatch(hex: string): Swatch {
  const n = parseInt(hex.slice(1), 16);
  return { css: hex, text: textOn(n >> 16, (n >> 8) & 255, n & 255) };
}

// The cover's most common colour, not its average: averaging muddies
// everything (a black cover with gold type came out brown, a white one with
// a flag came out beige). Pixels are grouped into bins and the biggest bin's
// mean is the answer. Full size, since covers are about 280x440 and
// downscaling first would let the browser's resampling blend colours.
export async function coverColour(src: string | null): Promise<Swatch> {
  if (!src) return FALLBACK;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  try {
    await img.decode();
  } catch (err) {
    console.warn(`bookshelf: could not load cover ${src}`, err);
    return FALLBACK;
  }
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return FALLBACK;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  const bins = new Map<number, [count: number, r: number, g: number, b: number]>();
  let best: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < px.length; i += 4) {
    const key = ((px[i] / BIN) | 0) * 4096 + ((px[i + 1] / BIN) | 0) * 64 + ((px[i + 2] / BIN) | 0);
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = [0, 0, 0, 0]));
    bin[0]++;
    bin[1] += px[i];
    bin[2] += px[i + 1];
    bin[3] += px[i + 2];
    if (bin[0] > best[0]) best = bin;
  }
  const [n, sr, sg, sb] = best;
  const r = Math.round(sr / n);
  const g = Math.round(sg / n);
  const b = Math.round(sb / n);
  return { css: `rgb(${r} ${g} ${b})`, text: textOn(r, g, b) };
}
