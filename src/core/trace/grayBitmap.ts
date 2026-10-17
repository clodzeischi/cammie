/** An 8-bit grayscale image: 0 = black, 255 = white, row-major. */
export interface GrayBitmap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * RGBA (as from canvas getImageData) → grayscale, compositing transparent
 * pixels over white so a transparent PNG background reads as "no ink".
 */
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): GrayBitmap {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    const alpha = rgba[j + 3]! / 255;
    const luma = 0.299 * rgba[j]! + 0.587 * rgba[j + 1]! + 0.114 * rgba[j + 2]!;
    data[i] = luma * alpha + 255 * (1 - alpha);
  }
  return { width, height, data };
}

/** One horizontal + one vertical box-blur pass of the given radius (pixels). */
function boxBlurPass(src: Float32Array, width: number, height: number, radius: number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const size = radius * 2 + 1;
  const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[row + clamp(k, width - 1)]!;
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / size;
      sum +=
        src[row + clamp(x + radius + 1, width - 1)]! - src[row + clamp(x - radius, width - 1)]!;
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += tmp[clamp(k, height - 1) * width + x]!;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / size;
      sum +=
        tmp[clamp(y + radius + 1, height - 1) * width + x]! -
        tmp[clamp(y - radius, height - 1) * width + x]!;
    }
  }
  return out;
}

/**
 * Smooths the image so traced edges come out as curves instead of pixel
 * stairs. Two box passes approximate a Gaussian. Radius 0 returns a copy.
 */
export function blur(bitmap: GrayBitmap, radius: number): Float32Array {
  let values = Float32Array.from(bitmap.data);
  const r = Math.round(radius);
  if (r <= 0) return values;
  for (let pass = 0; pass < 2; pass++) values = boxBlurPass(values, bitmap.width, bitmap.height, r);
  return values;
}

/**
 * Otsu's method: the threshold that best separates dark from light pixels.
 * When several thresholds tie (a clean two-tone image ties across the whole gap
 * between its tones), take the middle of the tie so blurred edges stay centred.
 */
export function otsuThreshold(bitmap: GrayBitmap): number {
  const histogram = new Array<number>(256).fill(0);
  for (const v of bitmap.data) histogram[v]!++;
  const total = bitmap.data.length;

  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i]!;

  let sumBelow = 0;
  let countBelow = 0;
  let bestVariance = -1;
  // Pixels below the threshold count as dark; t + 1 is the threshold for split point t.
  let tieStart = 128;
  let tieEnd = 128;
  for (let t = 0; t < 255; t++) {
    countBelow += histogram[t]!;
    sumBelow += t * histogram[t]!;
    const countAbove = total - countBelow;
    if (countBelow === 0 || countAbove === 0) continue;
    const meanBelow = sumBelow / countBelow;
    const meanAbove = (sumAll - sumBelow) / countAbove;
    const variance = countBelow * countAbove * (meanBelow - meanAbove) ** 2;
    if (variance > bestVariance * (1 + 1e-9)) {
      bestVariance = variance;
      tieStart = tieEnd = t + 1;
    } else if (variance >= bestVariance * (1 - 1e-9)) {
      tieEnd = t + 1;
    }
  }
  return Math.round((tieStart + tieEnd) / 2);
}
