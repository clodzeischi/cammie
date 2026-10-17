/// <reference lib="webworker" />
import type { GrayBitmap } from '../core/trace/grayBitmap';
import { traceImage, type TraceOptions, type TraceResult } from '../core/trace/traceImage';

export type TraceRequest =
  { type: 'load'; bitmap: GrayBitmap } | { type: 'trace'; id: number; options: TraceOptions };

export interface TraceResponse {
  id: number;
  result: TraceResult;
}

// Thin shell: all the work happens in core/trace.
let bitmap: GrayBitmap | null = null;

self.onmessage = (event: MessageEvent<TraceRequest>) => {
  const message = event.data;
  if (message.type === 'load') {
    bitmap = message.bitmap;
    return;
  }
  if (!bitmap) return;
  const response: TraceResponse = { id: message.id, result: traceImage(bitmap, message.options) };
  self.postMessage(response);
};
