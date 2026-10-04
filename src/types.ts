export type Skin = {
  id: string;
  sourceId: string;
  sourceName: string;
  image: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  order: number;
};

export type DetectionResult = {
  items: Omit<Skin, "id" | "order">[];
  columns: number;
  rows: number;
  confidence: number;
};
