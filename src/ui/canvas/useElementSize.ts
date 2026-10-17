import { useEffect, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

/** Tracks an element's size. Pass the returned setter as the element's `ref`. */
export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, Size] {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, size];
}
