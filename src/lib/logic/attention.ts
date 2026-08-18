// Dikkat listesi katmanlama mantığı (saf — prisma import etmez).
//
// Katmanlı düzenleme ilkesi: sistemin ürettiği kalem ve metinler ASLA
// değiştirilmez, gizlenmez veya bastırılmaz. Kullanıcının eklediği kalemler
// listeye AYRI bir kaynak (source = "ELLE") olarak eklenir ve panelde
// sistem kalemleriyle aynı kart biçiminde gösterilir.
import type { RiskLevel, RiskResult } from "@/lib/logic/risk";

export type AttentionSource = "SISTEM" | "ELLE";

/** Elle eklenen kalemin seviyesinden sentetik risk puanı. */
const MANUAL_SCORE: Record<RiskLevel, number> = { YUKSEK: 6, ORTA: 3, DUSUK: 1 };

/**
 * Elle eklenen kalem için, sistem kalemleriyle AYNI rozeti üretecek
 * sentetik RiskResult.
 *
 * Dikkat: "ELLE_EKLENDI" bir RiskRule DEĞİLDİR — RISK_RULES dizisine
 * eklenmez, computeRisk tarafından hesaplanmaz. Yalnızca gösterim amaçlı
 * bir faktördür; puanı kullanıcının seçtiği seviyeden gelir.
 * evaluatedRuleCount = 0, çünkü hiçbir kural değerlendirilmemiştir.
 */
export function manualRisk(level: RiskLevel): RiskResult {
  const score = MANUAL_SCORE[level];
  return {
    kind: "DIGER",
    score,
    level,
    factors: [{ key: "ELLE_EKLENDI", label: "Elle eklendi", points: score }],
    evaluatedRuleCount: 0,
  };
}

export interface AttentionValidity {
  status: string;
  validFrom: Date;
  validUntil: Date | null;
}

/**
 * Elle eklenen kalem şu an listede görünmeli mi?
 * "Bugün/yarın" kalemlerinin kendiliğinden düşmesini sağlar.
 * validUntil === now sınır durumu HÂLÂ aktiftir (kapsayıcı üst sınır).
 */
export function isAttentionItemActive(item: AttentionValidity, now: Date): boolean {
  if (item.status !== "ACIK") return false;
  if (item.validFrom.getTime() > now.getTime()) return false;
  if (item.validUntil !== null && item.validUntil.getTime() < now.getTime()) return false;
  return true;
}

/**
 * Sistem ve elle eklenen kalemleri birleştirir.
 *
 * • Elle kalemler sistemin risk<3 eşiğine TABİ DEĞİLDİR — kullanıcı bilerek
 *   eklediği için düşük seviyeli olsa da listede kalır.
 * • Sıralama: risk puanı azalan. Eşitlikte kullanıcının kendi kalemi üstte,
 *   çünkü sahadan gelen bilgi sistemin tahmininden önceliklidir.
 */
export function mergeAttentionItems<
  T extends { source: AttentionSource; risk: { score: number } },
>(system: T[], manual: T[]): T[] {
  return [...system, ...manual].sort((a, b) => {
    if (b.risk.score !== a.risk.score) return b.risk.score - a.risk.score;
    if (a.source === b.source) return 0;
    return a.source === "ELLE" ? -1 : 1;
  });
}

/** Geçerlilik penceresi seçenekleri — UI'daki "Bugün / Yarın / Süresiz". */
export type ValidityChoice = "BUGUN" | "YARIN" | "SURESIZ";

/**
 * Seçilen pencereyi mutlak tarihe çevirir.
 * "Bugün" = bugünün son anı, "Yarın" = yarının son anı, "Süresiz" = null.
 */
export function validUntilFor(choice: ValidityChoice, now: Date): Date | null {
  if (choice === "SURESIZ") return null;
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  if (choice === "YARIN") d.setDate(d.getDate() + 1);
  return d;
}
