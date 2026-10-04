export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface Skin {
  id: string;
  sourceId: string;
  sourceName: string;
  image: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  order: number;
}

export interface ExportOptions {
  width: number;
  columns: number;
  gap: number;
  padding: number;
  background: string;
  format: ExportFormat;
  quality: number;
}
