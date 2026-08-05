// Excel kazık import format tanımı — action, şablon endpoint'i ve UI aynı kaynağı kullanır.
export const PILE_IMPORT_HEADERS = [
  "Kazık Kodu",
  "Eleman Kodu",
  "Çap (mm)",
  "Tasarım Boyu (m)",
  "Beton Sınıfı",
] as const;

export interface ImportRowPreview {
  rowNumber: number;
  code: string;
  elementCode: string;
  diameterMm: number | null;
  designLengthM: number | null;
  concreteClass: string | null;
  errors: string[]; // boşsa satır geçerli
}

export interface ImportPreviewResult {
  ok: boolean;
  message: string;
  rows: ImportRowPreview[];
  validCount: number;
  errorCount: number;
}
