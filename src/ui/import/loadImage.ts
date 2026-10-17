import { rgbaToGray, type GrayBitmap } from '../../core/trace/grayBitmap';

/** Bigger images get scaled down: more pixels than this add time, not detail. */
const MAX_TRACE_SIDE = 2000;

export interface LoadedImage {
  name: string;
  bitmap: GrayBitmap;
  /** Object URL of the original file, for showing it behind the trace. */
  previewUrl: string;
}

export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/bmp';

/** Decodes an image file into a grayscale bitmap ready for tracing. */
export async function loadImage(file: File): Promise<LoadedImage> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, MAX_TRACE_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot read image pixels.');
  ctx.drawImage(image, 0, 0, width, height);
  image.close();

  const { data } = ctx.getImageData(0, 0, width, height);
  return {
    name: file.name.replace(/\.[^.]+$/, '') || 'image',
    bitmap: rgbaToGray(data, width, height),
    previewUrl: URL.createObjectURL(file),
  };
}
