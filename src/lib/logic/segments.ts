// Dengeli konsol segment zinciri (madde 5).
// Zincir korunur; ANCAK "Segment N+1 hangi koşullarda başlar" sorusunun cevabı
// KODDA SABİT DEĞİLDİR — proje / Method Statement / onaylı yapım sırası tarafından
// SegmentGateRule kaydıyla tanımlanır. Kural tanımlı değilse sistem varsayım üretmez,
// "Tanımlanmamış" der ve kapıyı değerlendirmez (madde 49).
// Asimetri kontrolü idari bir karşılaştırmadır — mühendislik/statik hesap DEĞİLDİR (madde 48).

export type StepStatusValue = "BEKLIYOR" | "DEVAM_EDIYOR" | "TAMAMLANDI";

export interface SegmentStepState {
  segmentNumber: number;
  side: "SOL" | "SAG" | "TEK";
  rebarStatus: StepStatusValue;
  formworkStatus: StepStatusValue;
  tendonStatus: StepStatusValue;
  anchorageStatus: StepStatusValue;
  embeddedItemsStatus: StepStatusValue;
  inspectionStatus: StepStatusValue;
  concreteStatus: StepStatusValue;
  postTensioningStatus: StepStatusValue;
  surveyStatus: StepStatusValue;
  groutingStatus: StepStatusValue;
  requiredConcreteStrengthMPa?: number | null;
  achievedConcreteStrengthMPa?: number | null;
}

/** Projeden gelen kapı kuralı. Hangi adımların sonraki segmenti bağladığını proje belirler. */
export interface SegmentGateRuleConfig {
  /** SegmentStepState alan adları. Boş dizi = hiçbir adım sonraki segmenti bağlamıyor. */
  requiredSteps: string[];
  /** Gerekli beton dayanımı şartı uygulanacak mı? */
  requireStrength: boolean;
  /** Sol/sağ ilerleme farkı için izin verilen eşik. */
  asymmetryThreshold: number;
  /** Method Statement / onaylı yapım sırası referansı. */
  note?: string | null;
}

export const SEGMENT_STEP_FIELDS = [
  "rebarStatus",
  "formworkStatus",
  "tendonStatus",
  "anchorageStatus",
  "embeddedItemsStatus",
  "inspectionStatus",
  "concreteStatus",
  "postTensioningStatus",
  "surveyStatus",
  "groutingStatus",
] as const;

export const STEP_LABELS: Record<string, string> = {
  rebarStatus: "Donatı",
  formworkStatus: "Kalıp",
  tendonStatus: "Tendon",
  anchorageStatus: "Ankraj",
  embeddedItemsStatus: "Gömülü Elemanlar",
  inspectionStatus: "Kontrol",
  concreteStatus: "Beton",
  postTensioningStatus: "Post-tensioning",
  surveyStatus: "Survey",
  groutingStatus: "Grouting",
};

export interface SegmentGateResult {
  /** Kural tanımlıysa kapının sonucu; tanımlı değilse null (bilinmiyor). */
  canStart: boolean | null;
  missingSteps: string[];
  /** Proje kuralı tanımlı değil → sistem karar üretmez. */
  ruleDefined: boolean;
  /** Kullanıcıya gösterilecek açıklama. */
  explanation: string;
}

/**
 * Bir sonraki segment başlayabilir mi?
 * @param previous Önceki segment (yoksa null → zincirin ilk segmenti)
 * @param rule Proje tarafından tanımlanmış kapı kuralı (yoksa null → değerlendirilmez)
 */
export function canStartNextSegment(
  previous: SegmentStepState | null,
  rule: SegmentGateRuleConfig | null
): SegmentGateResult {
  if (!previous) {
    return {
      canStart: true,
      missingSteps: [],
      ruleDefined: true,
      explanation: "Zincirin ilk segmenti — önceki segment koşulu yok.",
    };
  }
  if (!rule) {
    return {
      canStart: null,
      missingSteps: [],
      ruleDefined: false,
      explanation:
        "Segment başlama kuralı tanımlanmamış. Proje/Method Statement'a göre hangi adımların " +
        "sonraki segmenti bağladığı sisteme girilmelidir.",
    };
  }

  const missing: string[] = [];
  for (const step of rule.requiredSteps) {
    const value = (previous as unknown as Record<string, StepStatusValue | undefined>)[step];
    if (value === undefined) continue; // tanımsız alan adı → sessizce atlanır
    if (value !== "TAMAMLANDI") missing.push(STEP_LABELS[step] ?? step);
  }

  if (rule.requireStrength) {
    if (previous.requiredConcreteStrengthMPa == null) {
      // Gerekli dayanım projede tanımlı değil → varsayım üretme, eksik say.
      missing.push("Gerekli beton dayanımı (projede tanımlanmamış)");
    } else if (
      previous.achievedConcreteStrengthMPa == null ||
      previous.achievedConcreteStrengthMPa < previous.requiredConcreteStrengthMPa
    ) {
      missing.push("Gerekli beton dayanımı");
    }
  }

  return {
    canStart: missing.length === 0,
    missingSteps: missing,
    ruleDefined: true,
    explanation:
      missing.length === 0
        ? `Önceki segmentin proje kuralındaki tüm koşulları sağlandı.${rule.note ? ` (${rule.note})` : ""}`
        : `Önceki segmentte eksik: ${missing.join(", ")}.${rule.note ? ` Kural kaynağı: ${rule.note}` : ""}`,
  };
}

export interface AsymmetryResult {
  /** Kural tanımlı değilse null. */
  isUnbalanced: boolean | null;
  leftMax: number;
  rightMax: number;
  difference: number;
  threshold: number | null;
}

/** Sol/sağ tamamlanan son segment numaralarını karşılaştırır — idari kontrol. */
export function checkAsymmetry(
  segments: SegmentStepState[],
  rule: SegmentGateRuleConfig | null
): AsymmetryResult {
  const completedMax = (side: "SOL" | "SAG") =>
    segments
      .filter((s) => s.side === side && s.concreteStatus === "TAMAMLANDI")
      .reduce((max, s) => Math.max(max, s.segmentNumber), 0);
  const leftMax = completedMax("SOL");
  const rightMax = completedMax("SAG");
  const difference = Math.abs(leftMax - rightMax);
  if (!rule) {
    return { isUnbalanced: null, leftMax, rightMax, difference, threshold: null };
  }
  return {
    isUnbalanced: difference > rule.asymmetryThreshold,
    leftMax,
    rightMax,
    difference,
    threshold: rule.asymmetryThreshold,
  };
}
