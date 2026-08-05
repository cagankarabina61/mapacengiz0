// Yapı/eleman kod üretimi ve sıralaması (§43/§58/§61).
// Saf fonksiyonlar — DB'siz test edilebilir. Hiçbir yerde VIA-10/VIA-11 gibi
// özel durum yoktur; kurallar tüm yapı kodları için aynı çalışır.

/**
 * Kullanıcının girdiği yapı kodunu normalize eder: boşlukları kırpar, büyük harfe
 * çevirir, "VIA 11" / "via_11" gibi varyasyonları "VIA-11" biçimine getirir.
 * Tanınmayan biçimler olduğu gibi (yalnızca kırpılıp büyütülerek) döner —
 * sistem kullanıcının kodunu yeniden yazmaz, sadece toparlar.
 */
export function normalizeStructureCode(raw: string): string {
  const trimmed = raw.trim().toLocaleUpperCase("en");
  if (!trimmed) return "";
  // "VIA11", "VIA 11", "VIA_11", "VIA-11" → "VIA-11"
  const m = trimmed.match(/^([A-Z]+)[\s_-]*(\d+)$/);
  if (m) return `${m[1]}-${parseInt(m[2], 10)}`;
  return trimmed.replace(/\s+/g, "-");
}

/** Yapı kodu geçerli mi? En az bir harf, ardından ayraç ve sayı ya da serbest kod. */
export function isValidStructureCode(code: string): boolean {
  if (code.length < 2 || code.length > 32) return false;
  return /^[A-Z0-9][A-Z0-9-]*$/.test(code);
}

/** Kodu harf öneki + sayı parçalarına ayırır (sıralama için). */
function splitCode(code: string): { prefix: string; num: number | null } {
  const m = code.match(/^([A-Za-z]+)[\s_-]*(\d+)$/);
  if (m) return { prefix: m[1].toLocaleUpperCase("en"), num: parseInt(m[2], 10) };
  return { prefix: code.toLocaleUpperCase("en"), num: null };
}

/**
 * Doğal (sayısal-duyarlı) yapı kodu sıralaması.
 * Alfabetik sıralama VIA-1, VIA-10, VIA-11, VIA-2 üretir; bu fonksiyon
 * VIA-1, VIA-2, … VIA-10, VIA-11 sırasını verir (§59 — hızlı bulunabilirlik).
 */
export function compareStructureCodes(a: string, b: string): number {
  const pa = splitCode(a);
  const pb = splitCode(b);
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix, "tr");
  if (pa.num === null && pb.num === null) return a.localeCompare(b, "tr");
  if (pa.num === null) return 1; // sayısız kodlar sona
  if (pb.num === null) return -1;
  return pa.num - pb.num;
}

/** Eleman tipi → kod harfi. Yeni tip eklenirse burası tek değişim noktasıdır. */
export const ELEMENT_CODE_PREFIX: Record<string, string> = {
  PIER: "P",
  ABUTMENT: "A",
  PILE_CAP: "PC",
  PIER_GOVDESI: "PIER",
  BASLIK: "B",
  BEARING: "BR",
  DIGER: "X",
};

/** Yapı kodundan tire çıkarılmış eleman kodu öneki: "VIA-11" → "VIA11". */
export function elementCodeBase(structureCode: string): string {
  return structureCode.replace(/-/g, "");
}

/**
 * Üst seviye eleman kodu üretir: ("VIA-11", "PIER", 5) → "VIA11-P05".
 * Numara iki hane sıfır dolgulu (seed'deki mevcut düzenle birebir aynı).
 */
export function buildElementCode(
  structureCode: string,
  elementType: string,
  number: number
): string {
  const prefix = ELEMENT_CODE_PREFIX[elementType] ?? "X";
  return `${elementCodeBase(structureCode)}-${prefix}${String(number).padStart(2, "0")}`;
}

/** Alt eleman kodu: ("VIA11-P05", "PC") → "VIA11-P05-PC". */
export function buildChildCode(parentCode: string, suffix: string): string {
  return `${parentCode}-${suffix}`;
}

/** Kazık kodu: ("VIA11-P05", 3) → "VIA11-P05-PILE-03". */
export function buildPileCode(pierCode: string, index: number): string {
  return `${pierCode}-PILE-${String(index).padStart(2, "0")}`;
}

/** Segment kodu: ("VIA11-P05", "SOL", 7) → "VIA11-P05-SEG-L07". */
export function buildSegmentCode(pierCode: string, side: string, segmentNumber: number): string {
  const sideLetter = side === "SOL" ? "L" : side === "SAG" ? "R" : "S";
  return `${pierCode}-SEG-${sideLetter}${String(segmentNumber).padStart(2, "0")}`;
}
