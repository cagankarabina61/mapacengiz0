// Hazır / Başlanabilir ayrımı (madde 6).
//
// Bir iş için üç ayrı soru vardır ve bunlar birbirine karıştırılmaz:
//   1) PLANLANDI      → takvimde yeri var mı?           (plannedStart/plannedEnd dolu mu)
//   2) BASLANABILIR   → bağımlılıklar temiz mi?          (öncül iş, RFI, Hold Point, NCR blokajı,
//                                                        çizim, kazık kabulü)
//   3) IMALATA_HAZIR  → hazırlık kapısı da tamam mı?     (checklist/malzeme/ekip/ekipman)
//
// Bir iş planlanmış olabilir ama başlanabilir olmayabilir; başlanabilir olabilir ama
// imalata hazır olmayabilir. Sistem bu üçünü ayrı ayrı raporlar ve "ne yapılırsa hazır
// olur" sorusunu cevaplar (madde 11).

import type { BlockingReason } from "./blocking";

export type WorkState =
  | "PLANLANMADI"
  | "PLANLANDI"
  | "BASLANABILIR"
  | "IMALATA_HAZIR"
  | "DEVAM_EDIYOR"
  | "TAMAMLANDI"
  | "IPTAL";

export interface WorkStateInput {
  /** Kullanıcının/işin kaydedilmiş taban durumu. */
  recordedStatus: string;
  /** Takvimde yeri var mı? */
  hasSchedule: boolean;
  /** Bağımlılıklardan gelen sebepler (blokaj + uyarı karışık olabilir). */
  blockingReasons: BlockingReason[];
  /** Hazırlık kapısı eksikleri (checklist vb.). Boş = kapı geçildi. */
  missingPreparation: { label: string; responsible?: string }[];
  /** Hazırlık kapısı bu iş türü için tanımlı mı? Tanımsızsa kapı değerlendirilmez. */
  preparationGateDefined: boolean;
}

export interface WorkStateResult {
  state: WorkState;
  /** Bağımlılıklar temiz mi? */
  canStart: boolean;
  /** Hazırlık kapısı da tamam mı? */
  readyForWork: boolean;
  /** Neden hazır değil — kullanıcıya gösterilecek gerekçe listesi. */
  reasons: BlockingReason[];
  /** Ne yapılırsa hazır olur — sıradaki somut adımlar. */
  nextActions: string[];
  /** Kısa Türkçe özet. */
  summary: string;
}

export const WORK_STATE_LABELS: Record<WorkState, string> = {
  PLANLANMADI: "Planlanmadı",
  PLANLANDI: "Planlandı",
  BASLANABILIR: "Başlanabilir",
  IMALATA_HAZIR: "İmalata Hazır",
  DEVAM_EDIYOR: "Devam Ediyor",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
};

/**
 * Kaydedilmiş durumun üzerine, bağımlılık ve hazırlık kapısı sonuçlarını bindirerek
 * işin gerçek durumunu hesaplar. Devam eden/tamamlanan işler olduğu gibi bırakılır.
 */
export function computeWorkState(input: WorkStateInput): WorkStateResult {
  const terminal = ["DEVAM_EDIYOR", "TAMAMLANDI", "IPTAL"];
  const blockers = input.blockingReasons.filter((r) => r.level === "BLOKAJ");
  const canStart = blockers.length === 0;
  const preparationDone = input.preparationGateDefined && input.missingPreparation.length === 0;
  const readyForWork = canStart && preparationDone;

  if (terminal.includes(input.recordedStatus)) {
    return {
      state: input.recordedStatus as WorkState,
      canStart,
      readyForWork,
      reasons: input.blockingReasons,
      nextActions: [],
      summary: WORK_STATE_LABELS[input.recordedStatus as WorkState] ?? input.recordedStatus,
    };
  }

  const nextActions: string[] = [
    ...blockers.map((b) => b.nextAction),
    ...input.missingPreparation.map(
      (m) => `${m.label} tamamlanmalı${m.responsible ? ` (${m.responsible})` : ""}.`
    ),
  ];

  let state: WorkState;
  let summary: string;
  if (!input.hasSchedule) {
    state = "PLANLANMADI";
    summary = "Takvimde planlanmamış.";
    nextActions.unshift("Planlanan başlangıç/bitiş tarihlerinin girilmesi.");
  } else if (!canStart) {
    state = "PLANLANDI";
    summary = `Planlandı ancak başlanamaz — ${blockers.length} bağımlılık bekliyor.`;
  } else if (!input.preparationGateDefined) {
    // Kapı tanımlı değilse "hazır" iddia edilmez (madde 49).
    state = "BASLANABILIR";
    summary = "Bağımlılıklar temiz. Hazırlık kontrol listesi bu iş için tanımlanmamış.";
  } else if (!preparationDone) {
    state = "BASLANABILIR";
    summary = `Başlanabilir ancak imalata hazır değil — ${input.missingPreparation.length} hazırlık maddesi eksik.`;
  } else {
    state = "IMALATA_HAZIR";
    summary = "Bağımlılıklar temiz ve hazırlık tamam — imalata başlanabilir.";
  }

  return {
    state,
    canStart,
    readyForWork,
    reasons: input.blockingReasons,
    nextActions: [...new Set(nextActions)],
    summary,
  };
}
