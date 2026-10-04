export type ExportFormat = "png" | "jpeg" | "webp";

export interface Skin {
  id: string;
  image: HTMLImageElement;
  sx: number;
  sy: number;
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
