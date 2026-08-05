// "Pier Ekle" toplu kurulum önizlemesi (§52).
// Saf fonksiyon: hangi kayıtların oluşacağını hesaplar ama HİÇBİR ŞEY YAZMAZ.
// Kullanıcı önizlemeyi görüp onaylamadan veritabanına dokunulmaz.

import {
  buildElementCode,
  buildChildCode,
  buildPileCode,
  buildSegmentCode,
} from "./structure-codes";

export interface PierSetupInput {
  structureCode: string;
  /** Pier numarası (kullanıcı girer — sistem tahmin etmez). */
  pierNumber: number;
  /** Kazık sayısı. 0 = kazık grubu oluşturma. */
  pileCount: number;
  /** Kazık çapı (mm) — bilinmiyorsa null bırakılır, uydurulmaz (§49). */
  pileDiameterMm?: number | null;
  /** Tasarım kazık boyu (m) — bilinmiyorsa null. */
  pileDesignLengthM?: number | null;
  /** Bu pier'de dengeli konsol var mı? */
  hasBalancedCantilever: boolean;
  /** Dengeli konsol varsa taraf başına segment sayısı (S0..SN → N+1 adet). */
  segmentCount?: number;
  /** Şablondan gelecek iş kalemleri oluşturulsun mu? */
  createActivities: boolean;
}

export interface PreviewRecord {
  /** Kullanıcıya gösterilecek kategori adı. */
  category: string;
  code: string;
  name: string;
  /** Ek açıklama (tip, adet vb.). */
  detail?: string;
}

export interface PierSetupPreview {
  pierCode: string;
  records: PreviewRecord[];
  /** Kategori bazlı sayım — özet satırı için. */
  summary: { category: string; count: number }[];
  total: number;
  /** Kullanıcıya gösterilecek uyarılar (bilgi eksikliği vb.). */
  warnings: string[];
}

/**
 * Oluşturulacak kayıtların tam listesini üretir.
 * @param activityStepNames Eleman tipine göre şablon adım adları
 *   (DB'den gelir; şablon yoksa boş dizi → iş kalemi oluşmaz, varsayım üretilmez).
 */
export function buildPierSetupPreview(
  input: PierSetupInput,
  activityStepNames: { pileCap: string[]; pierBody: string[] } = { pileCap: [], pierBody: [] }
): PierSetupPreview {
  const records: PreviewRecord[] = [];
  const warnings: string[] = [];

  const pierCode = buildElementCode(input.structureCode, "PIER", input.pierNumber);
  records.push({
    category: "Pier",
    code: pierCode,
    name: `Pier ${input.pierNumber}`,
    detail: "Ana eleman",
  });

  // Alt elemanlar
  const pileCapCode = buildChildCode(pierCode, "PC");
  records.push({
    category: "Alt Eleman",
    code: pileCapCode,
    name: `Pier ${input.pierNumber} Pile Cap`,
    detail: "Pile Cap",
  });
  const pierBodyCode = buildChildCode(pierCode, "PIER");
  records.push({
    category: "Alt Eleman",
    code: pierBodyCode,
    name: `Pier ${input.pierNumber} Gövdesi`,
    detail: "Pier Gövdesi",
  });

  // Kazıklar
  if (input.pileCount > 0) {
    records.push({
      category: "Kazık Grubu",
      code: `${pierCode}-KG`,
      name: `Pier ${input.pierNumber} Kazık Grubu`,
      detail: `${input.pileCount} kazık planlandı`,
    });
    for (let i = 1; i <= input.pileCount; i++) {
      records.push({
        category: "Kazık",
        code: buildPileCode(pierCode, i),
        name: `Kazık ${i}`,
        detail: [
          input.pileDiameterMm ? `Ø${input.pileDiameterMm} mm` : null,
          input.pileDesignLengthM ? `${input.pileDesignLengthM} m` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Çap/boy belirtilmemiş",
      });
    }
    if (!input.pileDiameterMm || !input.pileDesignLengthM) {
      warnings.push(
        "Kazık çapı ve/veya tasarım boyu girilmedi; bu alanlar boş bırakılacak ve sonradan doldurulabilir."
      );
    }
  }

  // İş kalemleri (şablondan)
  if (input.createActivities) {
    for (const name of activityStepNames.pileCap) {
      records.push({
        category: "İş Kalemi",
        code: pileCapCode,
        name,
        detail: "Pile Cap",
      });
    }
    for (const name of activityStepNames.pierBody) {
      records.push({
        category: "İş Kalemi",
        code: pierBodyCode,
        name,
        detail: "Pier Gövdesi",
      });
    }
    if (activityStepNames.pileCap.length === 0 && activityStepNames.pierBody.length === 0) {
      warnings.push(
        "Bu eleman tipleri için iş akışı şablonu tanımlı değil; iş kalemi oluşturulmayacak."
      );
    }
  }

  // Dengeli konsol segmentleri
  if (input.hasBalancedCantilever) {
    const count = input.segmentCount ?? 0;
    if (count <= 0) {
      warnings.push("Dengeli konsol seçildi ancak segment sayısı girilmedi; segment oluşturulmayacak.");
    } else {
      for (const side of ["SOL", "SAG"] as const) {
        for (let n = 0; n <= count; n++) {
          records.push({
            category: "Dengeli Konsol Segmenti",
            code: buildSegmentCode(pierCode, side, n),
            name: `${side === "SOL" ? "Sol" : "Sağ"} S${n}`,
            detail: side === "SOL" ? "Sol taraf" : "Sağ taraf",
          });
        }
      }
    }
  }

  const summaryMap = new Map<string, number>();
  for (const r of records) {
    summaryMap.set(r.category, (summaryMap.get(r.category) ?? 0) + 1);
  }

  return {
    pierCode,
    records,
    summary: [...summaryMap.entries()].map(([category, count]) => ({ category, count })),
    total: records.length,
    warnings,
  };
}
