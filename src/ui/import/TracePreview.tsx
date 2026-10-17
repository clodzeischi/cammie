import { useEffect, useRef, useState } from 'react';
import type { TraceResult } from '../../core/trace/traceImage';

interface TracePreviewProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  result: TraceResult | null;
}

const BOX = { width: 520, height: 380 };

/** The original image, faded, with the traced outlines drawn on top. */
export function TracePreview({ imageUrl, imageWidth, imageHeight, result }: TracePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  const scale = Math.min(BOX.width / imageWidth, BOX.height / imageHeight);
  const width = Math.round(imageWidth * scale);
  const height = Math.round(imageHeight * scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (image) {
      ctx.globalAlpha = 0.25;
      ctx.drawImage(image, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    if (!result) return;

    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#b5562b';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (const path of result.paths) {
      path.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x * scale, p.y * scale);
        else ctx.lineTo(p.x * scale, p.y * scale);
      });
      ctx.closePath();
    }
    ctx.stroke();
  }, [image, result, scale, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="trace-preview"
      style={{ width, height }}
      aria-label="Traced outline preview"
    />
  );
}
