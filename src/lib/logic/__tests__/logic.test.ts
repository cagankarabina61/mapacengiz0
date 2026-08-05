// İş mantığı birim testleri — 12 maddelik düzeltme seti dahil.
import { describe, it, expect } from "vitest";
import { evaluatePourReadiness } from "../readiness";
import {
  rfiBlockingReasons,
  holdPointBlockingReasons,
  predecessorBlockingReasons,
  ncrBlockingReasons,
  drawingBlockingReasons,
  pileAcceptanceBlockingReasons,
  onlyBlocking,
} from "../blocking";
import {
  canStartNextSegment,
  checkAsymmetry,
  type SegmentStepState,
  type SegmentGateRuleConfig,
} from "../segments";
import { findConflicts, highestSeverity } from "../resources";
import { computeRisk, workKindForActivity, workKindForPour, RISK_RULES } from "../risk";
import { computeDelay } from "../delay";
import { summarizePileGroup } from "../piles";
import { computeWorkState } from "../workstate";
import { estimatePourDuration, pourWindow, formatDuration } from "../pour-planning";

const fullSegment = (over: Partial<SegmentStepState> = {}): SegmentStepState => ({
  segmentNumber: 7,
  side: "SOL",
  rebarStatus: "TAMAMLANDI",
  formworkStatus: "TAMAMLANDI",
  tendonStatus: "TAMAMLANDI",
  anchorageStatus: "TAMAMLANDI",
  embeddedItemsStatus: "TAMAMLANDI",
  inspectionStatus: "TAMAMLANDI",
  concreteStatus: "TAMAMLANDI",
  postTensioningStatus: "TAMAMLANDI",
  surveyStatus: "TAMAMLANDI",
  groutingStatus: "BEKLIYOR",
  ...over,
});

// Proje tarafından tanımlanmış örnek kural (kodda sabit DEĞİL)
const RULE_WITHOUT_GROUTING: SegmentGateRuleConfig = {
  requiredSteps: [
    "rebarStatus",
    "formworkStatus",
    "tendonStatus",
    "anchorageStatus",
    "embeddedItemsStatus",
    "inspectionStatus",
    "concreteStatus",
    "postTensioningStatus",
    "surveyStatus",
  ],
  requireStrength: true,
  asymmetryThreshold: 2,
  note: "Test kuralı",
};

const RULE_WITH_GROUTING: SegmentGateRuleConfig = {
  ...RULE_WITHOUT_GROUTING,
  requiredSteps: [...RULE_WITHOUT_GROUTING.requiredSteps, "groutingStatus"],
};

describe("TEST 1 — Beton hazırlık kapısı", () => {
  it("eksik QA/QC kontrolü olan beton HAZIR olamaz", () => {
    const result = evaluatePourReadiness({
      checklistItems: [
        { itemKey: "REBAR_DONE", label: "Donatı tamamlandı", isChecked: true },
        { itemKey: "QAQC_DONE", label: "QA/QC kontrolü tamamlandı", isChecked: false },
      ],
      isOverride: false,
    });
    expect(result.isReady).toBe(false);
    expect(result.missingItems.map((i) => i.itemKey)).toContain("QAQC_DONE");
  });

  it("override ancak gerekçeyle mümkün, viaOverride işaretlenir", () => {
    const noReason = evaluatePourReadiness({
      checklistItems: [{ itemKey: "QAQC_DONE", label: "QA/QC", isChecked: false }],
      isOverride: true,
      overrideReason: "  ",
    });
    expect(noReason.isReady).toBe(false);

    const withReason = evaluatePourReadiness({
      checklistItems: [{ itemKey: "QAQC_DONE", label: "QA/QC", isChecked: false }],
      isOverride: true,
      overrideReason: "Şantiye şefi onayı ile acil döküm",
    });
    expect(withReason.isReady).toBe(true);
    expect(withReason.viaOverride).toBe(true);
  });
});

describe("TEST 2 — Kazık grubu özeti", () => {
  it("test eksikse RISKLI, problemli varsa BLOKE, tümü kabulse TAMAMLANDI", () => {
    expect(
      summarizePileGroup([
        { status: "KABUL_EDILDI", testStatus: "YAPILDI", acceptanceStatus: "KABUL" },
        { status: "BETONLANDI", testStatus: "BEKLIYOR", acceptanceStatus: "BEKLIYOR" },
      ]).overall
    ).toBe("RISKLI");
    expect(
      summarizePileGroup([
        { status: "PROBLEMLI", testStatus: "BEKLIYOR", acceptanceStatus: "BEKLIYOR" },
      ]).overall
    ).toBe("BLOKE");
    expect(
      summarizePileGroup([
        { status: "KABUL_EDILDI", testStatus: "YAPILDI", acceptanceStatus: "KABUL" },
      ]).overall
    ).toBe("TAMAMLANDI");
  });
});

describe("MADDE 5 — Segment zinciri proje kuralına bağlı", () => {
  it("kural tanımlı değilse sistem karar ÜRETMEZ (varsayım yok)", () => {
    const gate = canStartNextSegment(fullSegment(), null);
    expect(gate.canStart).toBeNull();
    expect(gate.ruleDefined).toBe(false);
    expect(gate.explanation).toContain("tanımlanmamış");
  });

  it("grouting kurala DAHİL DEĞİLSE, grouting beklerken sonraki segment başlayabilir", () => {
    const gate = canStartNextSegment(fullSegment({ groutingStatus: "BEKLIYOR" }), {
      ...RULE_WITHOUT_GROUTING,
      requireStrength: false,
    });
    expect(gate.canStart).toBe(true);
  });

  it("grouting kurala DAHİLSE, aynı segment sonraki segmenti bloke eder", () => {
    const gate = canStartNextSegment(fullSegment({ groutingStatus: "BEKLIYOR" }), {
      ...RULE_WITH_GROUTING,
      requireStrength: false,
    });
    expect(gate.canStart).toBe(false);
    expect(gate.missingSteps).toContain("Grouting");
  });

  it("gerekli dayanım projede tanımlı değilse eksik sayılır, uydurulmaz", () => {
    const gate = canStartNextSegment(
      fullSegment({ requiredConcreteStrengthMPa: null }),
      RULE_WITHOUT_GROUTING
    );
    expect(gate.canStart).toBe(false);
    expect(gate.missingSteps.some((s) => s.includes("projede tanımlanmamış"))).toBe(true);
  });

  it("asimetri eşiği projeden gelir; kural yoksa karar üretilmez", () => {
    const segments: SegmentStepState[] = [];
    for (let i = 1; i <= 8; i++) segments.push(fullSegment({ segmentNumber: i, side: "SOL" }));
    for (let i = 1; i <= 5; i++) segments.push(fullSegment({ segmentNumber: i, side: "SAG" }));
    expect(checkAsymmetry(segments, null).isUnbalanced).toBeNull();
    const withRule = checkAsymmetry(segments, RULE_WITHOUT_GROUTING);
    expect(withRule.isUnbalanced).toBe(true);
    expect(withRule.difference).toBe(3);
    // Eşik 5 olsaydı dengesiz sayılmazdı
    expect(checkAsymmetry(segments, { ...RULE_WITHOUT_GROUTING, asymmetryThreshold: 5 }).isUnbalanced).toBe(
      false
    );
  });
});

describe("MADDE 4 — Kaynak çakışması seviyelendirme", () => {
  const base = {
    resourceId: "P-01",
    startDateTime: new Date("2026-08-06T09:00:00"),
    endDateTime: new Date("2026-08-06T12:00:00"),
    resourceLabel: "Pompa P-01",
    isPhysicallyExclusive: true,
  };

  it("fiziksel münhasır kaynakta uzun örtüşme KRİTİK üretir", () => {
    const conflicts = findConflicts(base, [
      {
        id: "b1",
        resourceId: "P-01",
        startDateTime: new Date("2026-08-06T07:00:00"),
        endDateTime: new Date("2026-08-06T10:00:00"),
        targetLabel: "VIA-10 P8 Betonu",
        isPhysicallyExclusive: true,
      },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("KRITIK");
    expect(conflicts[0].overlapMinutes).toBe(60);
    expect(conflicts[0].message).toContain("KRİTİK");
  });

  it("bölünebilir kaynakta aynı örtüşme yalnızca UYARI üretir", () => {
    const conflicts = findConflicts({ ...base, isPhysicallyExclusive: false }, [
      {
        id: "b1",
        resourceId: "P-01",
        startDateTime: new Date("2026-08-06T07:00:00"),
        endDateTime: new Date("2026-08-06T10:00:00"),
        isPhysicallyExclusive: false,
      },
    ]);
    expect(conflicts[0].severity).toBe("UYARI");
  });

  it("kısa örtüşme münhasır kaynakta UYARI'ya düşer", () => {
    const conflicts = findConflicts(base, [
      {
        id: "b1",
        resourceId: "P-01",
        startDateTime: new Date("2026-08-06T08:50:00"),
        endDateTime: new Date("2026-08-06T09:10:00"),
        isPhysicallyExclusive: true,
      },
    ]);
    expect(conflicts[0].severity).toBe("UYARI");
  });

  it("bitişik aralık çakışma değildir; override edilmiş çakışma en yüksek seviyeye sayılmaz", () => {
    expect(
      findConflicts(base, [
        {
          id: "b1",
          resourceId: "P-01",
          startDateTime: new Date("2026-08-06T06:00:00"),
          endDateTime: new Date("2026-08-06T09:00:00"),
        },
      ])
    ).toHaveLength(0);

    const overridden = findConflicts(base, [
      {
        id: "b1",
        resourceId: "P-01",
        startDateTime: new Date("2026-08-06T07:00:00"),
        endDateTime: new Date("2026-08-06T10:00:00"),
        isPhysicallyExclusive: true,
        conflictOverride: true,
      },
    ]);
    expect(overridden[0].overridden).toBe(true);
    expect(highestSeverity(overridden)).toBe("YOK");
  });
});

describe("MADDE 3 — İş türü bazlı risk motoru", () => {
  it("pompa kuralı yalnızca betona uygulanır, survey'e uygulanmaz", () => {
    const pumpRule = RISK_RULES.find((r) => r.key === "POMPA_YOK")!;
    expect(pumpRule.appliesTo).toContain("BETON");
    expect(pumpRule.appliesTo).not.toContain("SURVEY");

    const survey = computeRisk("SURVEY", { pumpUnassigned: true });
    expect(survey.factors.find((f) => f.key === "POMPA_YOK")).toBeUndefined();
    expect(survey.score).toBe(0);

    const beton = computeRisk("BETON", { pumpUnassigned: true });
    expect(beton.factors.find((f) => f.key === "POMPA_YOK")?.points).toBe(2);
  });

  it("kazık kabul kuralı yalnızca pile cap için anlamlıdır", () => {
    expect(
      computeRisk("SEGMENT", { pendingPileAcceptanceCount: 5 }).factors
    ).toHaveLength(0);
    expect(
      computeRisk("PILE_CAP", { pendingPileAcceptanceCount: 5 }).factors[0].key
    ).toBe("KAZIK_KABUL_BEKLIYOR");
  });

  it("segment kuralları yalnızca segmentte çalışır", () => {
    expect(computeRisk("BETON", { previousSegmentMissingSteps: 4 }).score).toBe(0);
    expect(computeRisk("SEGMENT", { previousSegmentMissingSteps: 4 }).score).toBe(3);
  });

  it("girdisi bilinmeyen kural atlanır — varsayım üretilmez", () => {
    const r = computeRisk("BETON", {});
    expect(r.score).toBe(0);
    expect(r.evaluatedRuleCount).toBe(0);
  });

  it("beton 48 saat kuralı + eksik ön koşul YÜKSEK risk verir, kırılım açıklanabilir", () => {
    const r = computeRisk("BETON", { hoursUntilPlanned: 20, checklistIncomplete: true });
    expect(r.score).toBeGreaterThanOrEqual(6);
    expect(r.level).toBe("YUKSEK");
    expect(r.factors.map((f) => f.key)).toContain("BETON_48H");
    expect(r.factors.map((f) => f.key)).toContain("ON_KOSUL_EKSIK");
  });

  it("kaynak çakışması seviyesine göre puanlanır", () => {
    expect(computeRisk("BETON", { resourceConflict: "KRITIK" }).score).toBe(3);
    expect(computeRisk("BETON", { resourceConflict: "UYARI" }).score).toBe(2);
    expect(computeRisk("BETON", { resourceConflict: "BILGI" }).score).toBe(0);
  });

  it("iş türü çıkarımı", () => {
    expect(workKindForActivity("REBAR", "PILE_CAP")).toBe("DONATI");
    expect(workKindForActivity("EXCAVATION", "PILE_CAP")).toBe("PILE_CAP");
    expect(workKindForPour("PILE")).toBe("KAZIK");
    expect(workKindForPour("SEGMENT")).toBe("SEGMENT");
  });
});

describe("MADDE 7 — NCR etkisi NCR bazında", () => {
  it("BLOKAJ bloke eder, UYARI uyarır, BILGILENDIRME listelenmez", () => {
    const reasons = ncrBlockingReasons([
      { ncrNumber: "NCR-1", status: "ACIK", impact: "BLOKAJ" },
      { ncrNumber: "NCR-2", status: "ACIK", impact: "UYARI" },
      { ncrNumber: "NCR-3", status: "ACIK", impact: "BILGILENDIRME" },
    ]);
    expect(reasons).toHaveLength(2);
    expect(onlyBlocking(reasons)).toHaveLength(1);
    expect(onlyBlocking(reasons)[0].message).toContain("NCR-1");
  });

  it("kapatılmış NCR hiç etkilemez", () => {
    expect(
      ncrBlockingReasons([{ ncrNumber: "NCR-1", status: "KAPATILDI", impact: "BLOKAJ" }])
    ).toHaveLength(0);
  });
});

describe("MADDE 8 — Çizim readiness", () => {
  it("onaylı çizim yoksa BLOKAJ", () => {
    const r = drawingBlockingReasons([
      { drawingCode: "VIA11-P05-REB", approvedRevisionCode: null, siteUsedRevisionCode: null },
    ]);
    expect(r[0].code).toBe("CIZIM_YOK");
    expect(r[0].level).toBe("BLOKAJ");
  });

  it("sahadaki revizyon eskiyse BLOKAJ, kaydedilmemişse UYARI", () => {
    const mismatch = drawingBlockingReasons([
      { drawingCode: "D1", approvedRevisionCode: "Rev.04", siteUsedRevisionCode: "Rev.03" },
    ]);
    expect(mismatch[0].level).toBe("BLOKAJ");
    expect(mismatch[0].message).toContain("Rev.04");

    const unknown = drawingBlockingReasons([
      { drawingCode: "D1", approvedRevisionCode: "Rev.04", siteUsedRevisionCode: null },
    ]);
    expect(unknown[0].level).toBe("UYARI");
  });

  it("revizyon güncelse sebep üretilmez", () => {
    expect(
      drawingBlockingReasons([
        { drawingCode: "D1", approvedRevisionCode: "Rev.04", siteUsedRevisionCode: "Rev.04" },
      ])
    ).toHaveLength(0);
  });
});

describe("MADDE 9 — Kazık kabulü ayrı bağımlılık", () => {
  it("kabul şart koşulmayan işte kazık eksikliği bloke ETMEZ", () => {
    expect(
      pileAcceptanceBlockingReasons({ totalPiles: 8, acceptedPiles: 4, required: false })
    ).toHaveLength(0);
  });

  it("şart koşan işte eksik kabul bloke eder", () => {
    const r = pileAcceptanceBlockingReasons({ totalPiles: 8, acceptedPiles: 4, required: true });
    expect(r).toHaveLength(1);
    expect(r[0].message).toContain("4/8");
  });

  it("tümü kabul edilmişse sebep kalmaz", () => {
    expect(
      pileAcceptanceBlockingReasons({ totalPiles: 8, acceptedPiles: 8, required: true })
    ).toHaveLength(0);
  });
});

describe("MADDE 6 — Planlandı / Başlanabilir / İmalata Hazır ayrımı", () => {
  const blocker = {
    code: "ONCUL_AKTIVITE" as const,
    level: "BLOKAJ" as const,
    message: "Öncül iş tamamlanmadı: Kalıp",
    responsible: "Saha",
    nextAction: '"Kalıp" işinin tamamlanması.',
  };

  it("planlanmış ama bağımlılığı olan iş PLANLANDI kalır", () => {
    const r = computeWorkState({
      recordedStatus: "PLANLANDI",
      hasSchedule: true,
      blockingReasons: [blocker],
      missingPreparation: [],
      preparationGateDefined: true,
    });
    expect(r.state).toBe("PLANLANDI");
    expect(r.canStart).toBe(false);
    expect(r.nextActions).toContain('"Kalıp" işinin tamamlanması.');
  });

  it("bağımlılık temiz ama hazırlık eksikse BASLANABILIR (imalata hazır değil)", () => {
    const r = computeWorkState({
      recordedStatus: "PLANLANDI",
      hasSchedule: true,
      blockingReasons: [],
      missingPreparation: [{ label: "QA/QC kontrolü" }],
      preparationGateDefined: true,
    });
    expect(r.state).toBe("BASLANABILIR");
    expect(r.canStart).toBe(true);
    expect(r.readyForWork).toBe(false);
  });

  it("her ikisi de tamamsa IMALATA_HAZIR", () => {
    const r = computeWorkState({
      recordedStatus: "PLANLANDI",
      hasSchedule: true,
      blockingReasons: [],
      missingPreparation: [],
      preparationGateDefined: true,
    });
    expect(r.state).toBe("IMALATA_HAZIR");
    expect(r.readyForWork).toBe(true);
  });

  it("hazırlık kapısı tanımlı değilse İMALATA HAZIR İDDİA EDİLMEZ", () => {
    const r = computeWorkState({
      recordedStatus: "PLANLANDI",
      hasSchedule: true,
      blockingReasons: [],
      missingPreparation: [],
      preparationGateDefined: false,
    });
    expect(r.state).toBe("BASLANABILIR");
    expect(r.summary).toContain("tanımlanmamış");
  });

  it("takvimi olmayan iş PLANLANMADI", () => {
    const r = computeWorkState({
      recordedStatus: "PLANLANDI",
      hasSchedule: false,
      blockingReasons: [],
      missingPreparation: [],
      preparationGateDefined: true,
    });
    expect(r.state).toBe("PLANLANMADI");
  });

  it("sadece UYARI seviyeli sebep başlamayı engellemez (madde 7)", () => {
    const r = computeWorkState({
      recordedStatus: "PLANLANDI",
      hasSchedule: true,
      blockingReasons: [{ ...blocker, level: "UYARI" }],
      missingPreparation: [],
      preparationGateDefined: true,
    });
    expect(r.canStart).toBe(true);
    expect(r.state).toBe("IMALATA_HAZIR");
  });
});

describe("MADDE 10 — Beton süre/pencere hesabı", () => {
  it("hacim ve pompa kapasitesinden süre hesaplanır", () => {
    const r = estimatePourDuration({ plannedVolumeM3: 145, pumpCapacityM3PerHour: 60 });
    // 145 / (60×0.7=42) = 3.452 sa = 207.1 dk; +30 hazırlık +30 temizlik → yukarı yuvarlanır
    expect(r.durationMin).toBe(268);
    expect(r.explanation).toContain("145 m³");
    expect(r.isOverride).toBe(false);
  });

  it("kapasite bilinmiyorsa süre UYDURULMAZ", () => {
    const r = estimatePourDuration({ plannedVolumeM3: 145, pumpCapacityM3PerHour: null });
    expect(r.durationMin).toBeNull();
    expect(r.explanation).toContain("hesaplanamadı");
  });

  it("elle girilen süre hesabı geçersiz kılar", () => {
    const r = estimatePourDuration({
      plannedVolumeM3: 145,
      pumpCapacityM3PerHour: 60,
      overrideDurationMin: 180,
    });
    expect(r.durationMin).toBe(180);
    expect(r.isOverride).toBe(true);
  });

  it("pencere süreye göre uzar; süre yoksa varsayılan kullanılır", () => {
    const w = pourWindow(new Date("2026-08-06T00:00:00"), "07:00", 267);
    expect(w.start.getHours()).toBe(7);
    expect(w.end.getTime() - w.start.getTime()).toBe(267 * 60000);
    expect(w.durationKnown).toBe(true);

    const fallback = pourWindow(new Date("2026-08-06T00:00:00"), "07:00", null);
    expect(fallback.durationKnown).toBe(false);
  });

  it("süre biçimlendirme", () => {
    expect(formatDuration(267)).toBe("4 sa 27 dk");
    expect(formatDuration(120)).toBe("2 sa");
    expect(formatDuration(45)).toBe("45 dk");
    expect(formatDuration(null)).toBe("Belirtilmemiş");
  });
});

describe("TEST 5/6 — Gecikme ve klasik bloke sebepleri", () => {
  const today = new Date("2026-08-04");
  it("planlanan bitiş geçmiş ve iş tamamlanmamış → GECİKMİŞ", () => {
    const result = computeDelay({
      plannedEnd: new Date("2026-08-01"),
      actualEnd: null,
      isCompleted: false,
      today,
    });
    expect(result.isDelayed).toBe(true);
    expect(result.delayDays).toBe(3);
  });

  it("açık RFI / Hold Point / öncül iş bloke eder", () => {
    expect(rfiBlockingReasons([{ rfiNumber: "RFI-024", status: "CEVAP_BEKLENIYOR" }])).toHaveLength(1);
    expect(rfiBlockingReasons([{ rfiNumber: "RFI-024", status: "CEVAPLANDI" }])).toHaveLength(0);
    expect(
      holdPointBlockingReasons([{ checkpointName: "Donatı Kontrolü", result: "BEKLIYOR" }])[0]
        .responsible
    ).toBe("QA/QC");
    expect(
      predecessorBlockingReasons([{ name: "Donatı", status: "DEVAM_EDIYOR" }])[0].message
    ).toContain("Donatı");
  });
});
