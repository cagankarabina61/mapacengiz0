// Dosya adı otomatik eşleştirme (madde 51): VIA11_P05_REBAR_REV04.pdf →
// yapı VIA-11, eleman P05, revizyon Rev.04 ÖNERİSİ üretir.
// Öneri asla otomatik kabul edilmez — kullanıcı onaylar (madde 51 açık talimatı).

export interface FilenameSuggestion {
  structureCode: string | null; // "VIA-11"
  elementToken: string | null; // "P05" / "P5" / "A1"
  revisionCode: string | null; // "Rev.04"
  disciplineToken: string | null; // "REBAR" gibi ham parça
}

/**
 * knownStructureCodes: DB'deki yapı kodları (örn. ["VIA-11", "VIA-10"]).
 * Dosya adındaki "VIA11" → "VIA-11" normalizasyonu bu listeye göre yapılır.
 */
export function parseDrawingFilename(
  fileName: string,
  knownStructureCodes: string[]
): FilenameSuggestion {
  const base = fileName.replace(/\.[a-z0-9]+$/i, ""); // uzantıyı at
  const tokens = base.split(/[_\-\s.]+/).filter(Boolean);

  const normalized = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLocaleUpperCase("en");
  const structureByNormalized = new Map(knownStructureCodes.map((c) => [normalized(c), c]));

  let structureCode: string | null = null;
  let elementToken: string | null = null;
  let revisionCode: string | null = null;
  const otherTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const norm = normalized(token);

    // Yapı kodu eşleşmesi: tek token (VIA11) veya bitişik iki token (VIA + 10 → "via-10")
    if (!structureCode) {
      if (structureByNormalized.has(norm)) {
        structureCode = structureByNormalized.get(norm)!;
        continue;
      }
      const pairNorm = i + 1 < tokens.length ? normalized(token + tokens[i + 1]) : null;
      if (pairNorm && structureByNormalized.has(pairNorm)) {
        structureCode = structureByNormalized.get(pairNorm)!;
        i++; // ikinci token'ı da tüket
        continue;
      }
    }
    // Revizyon: REV04 / R04 / REV4
    const revMatch = norm.match(/^R(?:EV)?(\d{1,2})$/);
    if (!revisionCode && revMatch) {
      revisionCode = `Rev.${revMatch[1].padStart(2, "0")}`;
      continue;
    }
    // Eleman: P05, P5, A1, A2, PIER5 gibi — baştaki sıfırlar atılır (P05 → P5)
    const elemMatch = norm.match(/^(P|A|PIER|ABUT)(\d{1,2})$/);
    if (!elementToken && elemMatch) {
      const prefix = elemMatch[1] === "PIER" ? "P" : elemMatch[1] === "ABUT" ? "A" : elemMatch[1];
      elementToken = `${prefix}${parseInt(elemMatch[2], 10)}`;
      continue;
    }
    otherTokens.push(token);
  }

  return {
    structureCode,
    elementToken,
    revisionCode,
    disciplineToken: otherTokens.length > 0 ? otherTokens.join("_") : null,
  };
}

/**
 * Eleman token'ını ("P5"/"P05") gerçek eleman koduna eşler.
 * Örn. token P5 → "VIA11-P05" (kod içinde P05 veya P5 segmenti arar).
 */
export function matchElementCode(
  elementToken: string,
  candidateElementCodes: string[]
): string | null {
  const m = elementToken.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const prefix = m[1].toLocaleUpperCase("en");
  const num = parseInt(m[2], 10);
  for (const code of candidateElementCodes) {
    const segments = code.toLocaleUpperCase("en").split("-");
    for (const seg of segments) {
      const sm = seg.match(/^([A-Z]+)(\d+)$/);
      if (sm && sm[1] === prefix && parseInt(sm[2], 10) === num) return code;
    }
  }
  return null;
}
