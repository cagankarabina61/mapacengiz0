// Pier bazlı kazık özeti (tasarım §6, madde 16) — sorgu zamanında hesaplanır, saklanmaz.

export interface PileSummaryInput {
  status: string; // PileStatus
  testStatus: string; // PileTestStatus
  acceptanceStatus: string; // PileAcceptanceStatus
}

export type PileGroupOverallStatus = "TAMAMLANDI" | "BLOKE" | "RISKLI" | "DEVAM_EDIYOR";

export interface PileGroupSummary {
  total: number;
  concreted: number; // en az Betonlandı aşamasına gelmiş
  tested: number;
  accepted: number;
  problemCount: number;
  overall: PileGroupOverallStatus;
  overallReason: string;
}

const CONCRETED_OR_LATER = new Set([
  "BETONLANDI",
  "TEST_BEKLIYOR",
  "TEST_YAPILDI",
  "KABUL_EDILDI",
]);

export function summarizePileGroup(piles: PileSummaryInput[]): PileGroupSummary {
  const total = piles.length;
  const concreted = piles.filter((p) => CONCRETED_OR_LATER.has(p.status)).length;
  const tested = piles.filter((p) => p.testStatus === "YAPILDI").length;
  const accepted = piles.filter((p) => p.acceptanceStatus === "KABUL").length;
  const problemCount = piles.filter((p) => p.status === "PROBLEMLI").length;

  let overall: PileGroupOverallStatus;
  let overallReason: string;
  if (problemCount > 0) {
    overall = "BLOKE";
    overallReason = `${problemCount} kazık problemli.`;
  } else if (total > 0 && accepted === total) {
    overall = "TAMAMLANDI";
    overallReason = "Tüm kazıklar kabul edildi.";
  } else if (total > 0 && concreted === total && (tested < total || accepted < total)) {
    overall = "RISKLI";
    overallReason = `${total - Math.min(tested, accepted)} kazığın testi/kabulü tamamlanmamış.`;
  } else {
    overall = "DEVAM_EDIYOR";
    overallReason = `${concreted}/${total} kazık betonlandı.`;
  }

  return { total, concreted, tested, accepted, problemCount, overall, overallReason };
}
