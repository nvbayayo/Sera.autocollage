import type { ExportOptions, Skin } from './types';

function getMimeType(format: ExportOptions['format']): string {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(`The browser could not encode the image as ${mimeType}.`));
    }, mimeType, quality);
  });
}

function safeNumber(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export async function exportCollage(skins: Skin[], options: ExportOptions): Promise<Blob> {
  if (!skins.length) throw new Error('Add at least one detected item first.');

  const width = Math.floor(safeNumber(options.width, 2048, 256, 16000));
  const columns = Math.floor(safeNumber(options.columns, 5, 1, 20));
  const gap = Math.floor(safeNumber(options.gap, 16, 0, 1000));
  const padding = Math.floor(safeNumber(options.padding, 16, 0, 1000));
  const quality = safeNumber(options.quality, 0.95, 0.1, 1);

  const ordered = [...skins].sort((a, b) => a.order - b.order);
  const first = ordered[0];
  if (!first.image.naturalWidth || !first.image.naturalHeight) {
    throw new Error('The source image has not finished loading.');
  }

  const firstAspect = Math.max(0.1, first.sw / Math.max(1, first.sh));
  const cellWidth = Math.max(1, Math.floor((width - padding * 2 - gap * (columns - 1)) / columns));
  const cellHeight = Math.max(1, Math.round(cellWidth / firstAspect));
  const rows = Math.ceil(ordered.length / columns);
  const height = Math.max(1, padding * 2 + rows * cellHeight + gap * (rows - 1));

  if (width > 32767 || height > 32767) {
    throw new Error('This browser cannot create a canvas larger than 32767 pixels on one side.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the export canvas.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = options.background || '#000000';
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < ordered.length; index++) {
    const skin = ordered[index];
    const image = skin.image;
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error(`Source image for item ${index + 1} is not loaded.`);
    }

    const sx = Math.max(0, Math.min(image.naturalWidth - 1, Math.floor(skin.sx)));
    const sy = Math.max(0, Math.min(image.naturalHeight - 1, Math.floor(skin.sy)));
    const sw = Math.max(1, Math.min(Math.floor(skin.sw), image.naturalWidth - sx));
    const sh = Math.max(1, Math.min(Math.floor(skin.sh), image.naturalHeight - sy));

    const col = index % columns;
    const row = Math.floor(index / columns);
    const dx = padding + col * (cellWidth + gap);
    const dy = padding + row * (cellHeight + gap);

    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, cellWidth, cellHeight);
  }

  const mime = getMimeType(options.format);
  return canvasToBlob(canvas, mime, options.format === 'png' ? 1 : quality);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
