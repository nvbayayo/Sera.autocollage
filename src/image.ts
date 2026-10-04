import type { Skin } from './types';

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  boxes: DetectionBox[];
  columns: number;
  rows: number;
  confidence: number;
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load image: ${file.name}`));
    };
    image.src = url;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreCell(data: Uint8ClampedArray, width: number, height: number): number {
  const stepX = Math.max(1, Math.floor(width / 12));
  const stepY = Math.max(1, Math.floor(height / 12));
  let samples = 0;
  let sum = 0;
  let sumSq = 0;

  for (let y = Math.floor(stepY / 2); y < height; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < width; x += stepX) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luminance;
      sumSq += luminance * luminance;
      samples++;
    }
  }

  if (!samples) return 0;
  const mean = sum / samples;
  const variance = Math.max(0, sumSq / samples - mean * mean);
  return Math.sqrt(variance);
}

export async function detectScreenshot(
  image: HTMLImageElement,
  onProgress?: (progress: number) => void,
): Promise<DetectionResult> {
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('Image is not loaded.');
  }

  onProgress?.(5);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser could not create a detection canvas.');

  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  onProgress?.(20);

  const candidates = [3, 4, 5, 6, 7, 8, 9, 10];
  let best: { boxes: DetectionBox[]; columns: number; rows: number; confidence: number } | null = null;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
    const columns = candidates[candidateIndex];
    const aspect = 0.72;
    const cellWidth = width / columns;
    const estimatedCellHeight = cellWidth / aspect;
    const rows = Math.max(1, Math.round(height / estimatedCellHeight));
    const cellHeight = height / rows;

    const scores: number[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x0 = Math.floor(col * cellWidth);
        const y0 = Math.floor(row * cellHeight);
        const x1 = Math.floor((col + 1) * cellWidth);
        const y1 = Math.floor((row + 1) * cellHeight);
        const cw = Math.max(1, x1 - x0);
        const ch = Math.max(1, y1 - y0);
        const sample = ctx.getImageData(x0, y0, cw, ch).data;
        scores.push(scoreCell(sample, cw, ch));
      }
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const threshold = Math.max(10, median * 0.72);
    const boxes: DetectionBox[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const score = scores[row * columns + col];
        if (score >= threshold) {
          boxes.push({
            x: Math.round((col * width / columns) / scale),
            y: Math.round((row * height / rows) / scale),
            width: Math.round((width / columns) / scale),
            height: Math.round((height / rows) / scale),
          });
        }
      }
    }

    const fill = boxes.length / Math.max(1, rows * columns);
    const shapeScore = 1 - Math.min(1, Math.abs((cellWidth / cellHeight) - aspect) / aspect);
    const confidence = Math.max(0, Math.min(1, 0.55 * fill + 0.45 * shapeScore));

    if (!best || Math.abs(fill - 0.5) < Math.abs((best.boxes.length / Math.max(1, best.rows * best.columns)) - 0.5)) {
      best = { boxes, columns, rows, confidence };
    }

    onProgress?.(20 + ((candidateIndex + 1) / candidates.length) * 65);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  if (!best || best.boxes.length === 0) {
    const columns = 5;
    const rows = Math.max(1, Math.round(image.naturalHeight / (image.naturalWidth / columns / 0.72)));
    const boxes: DetectionBox[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        boxes.push({
          x: Math.round(col * image.naturalWidth / columns),
          y: Math.round(row * image.naturalHeight / rows),
          width: Math.round(image.naturalWidth / columns),
          height: Math.round(image.naturalHeight / rows),
        });
      }
    }
    best = { boxes, columns, rows, confidence: 0.15 };
  }

  onProgress?.(100);
  return best;
}

export function makeSkins(image: HTMLImageElement, detection: DetectionResult, sourceName = 'MLBB screenshot'): Skin[] {
  return detection.boxes.map((box, index) => {
    const x = clamp(Math.floor(box.x), 0, Math.max(0, image.naturalWidth - 1));
    const y = clamp(Math.floor(box.y), 0, Math.max(0, image.naturalHeight - 1));
    const sw = clamp(Math.floor(box.width), 1, image.naturalWidth - x);
    const sh = clamp(Math.floor(box.height), 1, image.naturalHeight - y);

    return {
      id: `skin-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      sourceId: 'uploaded-screenshot',
      sourceName,
      image,
      sx: x,
      sy: y,
      sw,
      sh,
      order: index,
    };
  });
}
