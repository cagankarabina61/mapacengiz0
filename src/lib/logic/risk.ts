// İş türü bazlı risk motoru (madde 3).
// Universal formül YOKTUR: her kural yalnızca anlamlı olduğu iş türlerine uygulanır.
// Bir kuralın girdisi bilinmiyorsa (undefined) kural atlanır — varsayım üretilmez (madde 49).

/** Risk kurallarının uygulandığı iş türleri. */
export type WorkKind =
  | "BETON" // ConcretePour (hedefinden bağımsız ortak kurallar)
  | "KAZIK" // Pile imalatı / kazık dökümü
  | "PILE_CAP"
  | "PIER"
  | "SEGMENT" // dengeli konsol segmenti
  | "SURVEY"
  | "QAQC"
  | "DONATI"
  | "KALIP"
  | "DIGER";

/**
 * Risk girdileri. Tüm alanlar opsiyoneldir: `undefined` = "bu iş türü için ölçülmedi/anlamsız".
 * Kural motoru yalnızca hem iş türüne uygulanan hem de girdisi tanımlı olan kuralları çalıştırır.
 */
export interface RiskSignals {
  /** Planlanan tarihe kalan saat (negatif = tarih geçmiş). */
  hoursUntilPlanned?: number;
  /** Hazırlık kapısı (checklist) eksik mi? */
  checklistIncomplete?: boolean;
  /** Eksik ön koşul sayısı (checklist/kapı) — ölçek için. */
  missingPrerequisiteCount?: number;
  /** İşi bloke eden açık RFI var mı? */
  openRFI?: boolean;
  /** QA/QC kontrolü bekliyor mu? */
  qaqcPending?: boolean;
  /** Serbest bırakılmamış Hold Point var mı? */
  holdPointPending?: boolean;
  /** Survey tamamlanmadı mı? */
  surveyPending?: boolean;
  /** Kaynak çakışması seviyesi. */
  resourceConflict?: "YOK" | "BILGI" | "UYARI" | "KRITIK";
  /** Onaylı çizim yok mu? */
  drawingMissing?: boolean;
  /** Sahadaki revizyon son onaylıdan farklı mı? */
  drawingRevisionMismatch?: boolean;
  /** Bloke etkili açık NCR var mı? */
  ncrBlocking?: boolean;
  /** Uyarı etkili açık NCR var mı? */
  ncrWarning?: boolean;
  /** Kazık kabulü bekleyen adet (yalnızca kazığa bağlı işler için anlamlı). */
  pendingPileAcceptanceCount?: number;
  /** Önceki segmentin eksik adım sayısı (yalnızca segment için anlamlı). */
  previousSegmentMissingSteps?: number;
  /** Segment sol/sağ ilerleme farkı eşiği aşıyor mu? */
  segmentAsymmetryExceeded?: boolean;
  /** Beton dayanımı gerekli seviyeye ulaşmadı mı? (segment/post-tensioning) */
  strengthNotReached?: boolean;
  /** Pompa atanmadı mı? (yalnızca beton için) */
  pumpUnassigned?: boolean;
  /** Ekip atanmadı mı? */
  crewUnassigned?: boolean;
  /** Planlanan bitişi geçmiş ve tamamlanmamış mı? */
  overdue?: boolean;
  /** Gecikme gün sayısı. */
  delayDays?: number;
}

export interface RiskRule {
  key: string;
  /** Kuralın anlamlı olduğu iş türleri. */
  appliesTo: WorkKind[];
  /** Kullanıcıya gösterilecek Türkçe açıklama. */
  label: string;
  /** Girdi tanımlı değilse kural atlanır. */
  evaluate: (s: RiskSignals) => number | null;
}

/**
 * Kural kataloğu. Her kural yalnızca listelendiği iş türlerinde çalışır.
 * Örn. "pompa atanmadı" kazık delgisi için anlamsızdır → BETON dışında uygulanmaz.
 */
export const RISK_RULES: RiskRule[] = [
  // ── Zamanlama ────────────────────────────────────────────
  {
    key: "BETON_48H",
    appliesTo: ["BETON"],
    label: "Beton dökümüne 48 saatten az kaldı",
    evaluate: (s) =>
      s.hoursUntilPlanned === undefined ? null : s.hoursUntilPlanned >= 0 && s.hoursUntilPlanned <= 48 ? 3 : 0,
  },
  {
    key: "YAKIN_TARIH",
    appliesTo: ["KAZIK", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP", "SURVEY", "QAQC", "DIGER"],
    label: "Planlanan başlangıca 24 saatten az kaldı",
    evaluate: (s) =>
      s.hoursUntilPlanned === undefined ? null : s.hoursUntilPlanned >= 0 && s.hoursUntilPlanned <= 24 ? 1 : 0,
  },
  {
    key: "GECIKMIS",
    appliesTo: ["BETON", "KAZIK", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP", "SURVEY", "QAQC", "DIGER"],
    label: "İş planlanan bitişi geçti",
    evaluate: (s) => {
      if (s.overdue === undefined) return null;
      if (!s.overdue) return 0;
      const days = s.delayDays ?? 1;
      return days >= 7 ? 3 : days >= 3 ? 2 : 1;
    },
  },

  // ── Hazırlık kapısı ──────────────────────────────────────
  {
    key: "ON_KOSUL_EKSIK",
    appliesTo: ["BETON", "PILE_CAP", "PIER", "SEGMENT"],
    label: "Hazırlık kapısı ön koşulları eksik",
    evaluate: (s) => (s.checklistIncomplete === undefined ? null : s.checklistIncomplete ? 3 : 0),
  },

  // ── Teknik ofis ──────────────────────────────────────────
  {
    key: "RFI_ACIK",
    appliesTo: ["BETON", "KAZIK", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP"],
    label: "Cevaplanmamış RFI işi etkiliyor",
    evaluate: (s) => (s.openRFI === undefined ? null : s.openRFI ? 2 : 0),
  },
  {
    key: "CIZIM_YOK",
    appliesTo: ["BETON", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP"],
    label: "Onaylı çizim bulunamadı",
    evaluate: (s) => (s.drawingMissing === undefined ? null : s.drawingMissing ? 3 : 0),
  },
  {
    key: "CIZIM_REVIZYON",
    appliesTo: ["BETON", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP"],
    label: "Sahadaki çizim revizyonu son onaylıdan farklı",
    evaluate: (s) =>
      s.drawingRevisionMismatch === undefined ? null : s.drawingRevisionMismatch ? 3 : 0,
  },

  // ── QA/QC ────────────────────────────────────────────────
  {
    key: "QAQC_BEKLIYOR",
    appliesTo: ["BETON", "PILE_CAP", "PIER", "SEGMENT", "KAZIK"],
    label: "QA/QC kontrolü tamamlanmadı",
    evaluate: (s) => (s.qaqcPending === undefined ? null : s.qaqcPending ? 2 : 0),
  },
  {
    key: "HOLD_POINT",
    appliesTo: ["BETON", "PILE_CAP", "PIER", "SEGMENT"],
    label: "Hold Point serbest bırakılmadı",
    evaluate: (s) => (s.holdPointPending === undefined ? null : s.holdPointPending ? 2 : 0),
  },
  {
    key: "SURVEY_BEKLIYOR",
    appliesTo: ["BETON", "PILE_CAP", "PIER", "SEGMENT"],
    label: "Survey tamamlanmadı",
    evaluate: (s) => (s.surveyPending === undefined ? null : s.surveyPending ? 2 : 0),
  },
  {
    key: "NCR_BLOKAJ",
    appliesTo: ["BETON", "KAZIK", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP", "SURVEY", "QAQC", "DIGER"],
    label: "Blokaj etkili açık NCR var",
    evaluate: (s) => (s.ncrBlocking === undefined ? null : s.ncrBlocking ? 3 : 0),
  },
  {
    key: "NCR_UYARI",
    appliesTo: ["BETON", "KAZIK", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP", "SURVEY", "QAQC", "DIGER"],
    label: "Uyarı etkili açık NCR var",
    evaluate: (s) => (s.ncrWarning === undefined ? null : s.ncrWarning ? 1 : 0),
  },

  // ── Kaynak ───────────────────────────────────────────────
  {
    key: "KAYNAK_CAKISMASI",
    appliesTo: ["BETON", "KAZIK", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP", "SURVEY"],
    label: "Kaynak çakışması var",
    evaluate: (s) => {
      if (s.resourceConflict === undefined) return null;
      return s.resourceConflict === "KRITIK" ? 3 : s.resourceConflict === "UYARI" ? 2 : 0;
    },
  },
  {
    key: "POMPA_YOK",
    appliesTo: ["BETON"],
    label: "Beton pompası atanmadı",
    evaluate: (s) => (s.pumpUnassigned === undefined ? null : s.pumpUnassigned ? 2 : 0),
  },
  {
    key: "EKIP_YOK",
    appliesTo: ["BETON", "KAZIK", "PILE_CAP", "PIER", "SEGMENT", "DONATI", "KALIP"],
    label: "Ekip atanmadı",
    evaluate: (s) => (s.crewUnassigned === undefined ? null : s.crewUnassigned ? 1 : 0),
  },

  // ── Kazık → Pile Cap bağımlılığı (yalnızca ilgili işlerde) ─
  {
    key: "KAZIK_KABUL_BEKLIYOR",
    appliesTo: ["PILE_CAP"],
    label: "Kabulü tamamlanmamış kazık var",
    evaluate: (s) => {
      if (s.pendingPileAcceptanceCount === undefined) return null;
      return s.pendingPileAcceptanceCount === 0 ? 0 : s.pendingPileAcceptanceCount > 3 ? 3 : 2;
    },
  },

  // ── Dengeli konsol (yalnızca segment) ────────────────────
  {
    key: "ONCEKI_SEGMENT",
    appliesTo: ["SEGMENT"],
    label: "Önceki segment tamamlanmadı",
    evaluate: (s) => {
      if (s.previousSegmentMissingSteps === undefined) return null;
      return s.previousSegmentMissingSteps === 0 ? 0 : s.previousSegmentMissingSteps > 3 ? 3 : 2;
    },
  },
  {
    key: "SEGMENT_ASIMETRI",
    appliesTo: ["SEGMENT"],
    label: "Sol/sağ segment ilerlemesi izin verilen farkı aşıyor",
    evaluate: (s) =>
      s.segmentAsymmetryExceeded === undefined ? null : s.segmentAsymmetryExceeded ? 2 : 0,
  },
  {
    key: "DAYANIM_YETERSIZ",
    appliesTo: ["SEGMENT"],
    label: "Gerekli beton dayanımına ulaşılmadı",
    evaluate: (s) => (s.strengthNotReached === undefined ? null : s.strengthNotReached ? 3 : 0),
  },
];

export interface RiskFactor {
  key: string;
  label: string;
  points: number;
}

export type RiskLevel = "DUSUK" | "ORTA" | "YUKSEK";

export interface RiskResult {
  kind: WorkKind;
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  /** Bu iş türüne uygulanan ama tetiklenmeyen kural sayısı — şeffaflık için. */
  evaluatedRuleCount: number;
}

/**
 * Verilen iş türü için yalnızca ilgili kuralları çalıştırır.
 * Anlamsız kural uygulanmaz; girdisi bilinmeyen kural atlanır.
 */
export function computeRisk(kind: WorkKind, signals: RiskSignals): RiskResult {
  const factors: RiskFactor[] = [];
  let evaluatedRuleCount = 0;

  for (const rule of RISK_RULES) {
    if (!rule.appliesTo.includes(kind)) continue; // iş türüne anlamsız → uygulanmaz
    const points = rule.evaluate(signals);
    if (points === null) continue; // girdi bilinmiyor → atlanır (varsayım yok)
    evaluatedRuleCount++;
    if (points > 0) factors.push({ key: rule.key, label: rule.label, points });
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const level: RiskLevel = score >= 6 ? "YUKSEK" : score >= 3 ? "ORTA" : "DUSUK";
  return { kind, score, level, factors, evaluatedRuleCount };
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  DUSUK: "Düşük",
  ORTA: "Orta",
  YUKSEK: "Yüksek",
};

export const WORK_KIND_LABELS: Record<WorkKind, string> = {
  BETON: "Beton",
  KAZIK: "Kazık",
  PILE_CAP: "Pile Cap",
  PIER: "Pier",
  SEGMENT: "Dengeli Konsol Segmenti",
  SURVEY: "Survey",
  QAQC: "QA/QC",
  DONATI: "Donatı",
  KALIP: "Kalıp",
  DIGER: "Diğer",
};

/** Eleman tipi + aktivite tipinden iş türü çıkarımı. */
export function workKindForActivity(activityType: string, elementType?: string | null): WorkKind {
  const t = activityType.toLocaleUpperCase("en");
  if (t.includes("SURVEY")) return "SURVEY";
  if (t.includes("REBAR") || t.includes("DONATI")) return "DONATI";
  if (t.includes("FORMWORK") || t.includes("KALIP")) return "KALIP";
  if (t.includes("CONCRETE") || t.includes("BETON")) return "BETON";
  switch (elementType) {
    case "PILE_CAP":
      return "PILE_CAP";
    case "PIER":
    case "PIER_GOVDESI":
      return "PIER";
    default:
      return "DIGER";
  }
}

/** Beton dökümünün hedefine göre iş türü. */
export function workKindForPour(targetType: string): WorkKind {
  if (targetType === "PILE") return "KAZIK";
  if (targetType === "SEGMENT") return "SEGMENT";
  return "BETON";
}
