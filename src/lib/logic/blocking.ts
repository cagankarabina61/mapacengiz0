// Bloke motoru (madde 7/8/9): tüm bloke sebepleri tek yerde toplanır.
// "Bloke" saklanan bir durum değil, gerçek bağımlılıklardan hesaplanan bir göstergedir.
// Her sebep: NEDEN / SORUMLU / SONRAKİ İŞLEM üçlüsünü taşır (madde 11).

export type BlockingCode =
  | "RFI_ACIK"
  | "ITP_HOLD_POINT"
  | "ONCUL_AKTIVITE"
  | "CHECKLIST_EKSIK"
  | "ONCEKI_SEGMENT"
  | "CIZIM_YOK"
  | "CIZIM_REVIZYON"
  | "NCR_BLOKAJ"
  | "KAZIK_KABUL";

/** Blokaj mı yoksa yalnızca uyarı mı — madde 7 (NCR) ve madde 8 (çizim) için ayrım şart. */
export type BlockingLevel = "BLOKAJ" | "UYARI" | "BILGI";

export interface BlockingReason {
  code: BlockingCode;
  level: BlockingLevel;
  message: string; // Türkçe, kullanıcıya gösterilir
  responsible: string; // "Teknik Ofis" | "QA/QC" | ...
  nextAction: string; // "Ne yapılırsa hazır olur?" (madde 11)
}

export interface OpenRFIRef {
  rfiNumber: string;
  status: string; // RFIStatus
}

export interface HoldPointRef {
  checkpointName: string;
  result: string; // InspectionResult
}

export interface PredecessorRef {
  name: string;
  status: string; // ActivityStatus
}

export interface NCRRef {
  ncrNumber: string;
  status: string; // NCRStatus
  impact: string; // NCRImpact: BILGILENDIRME | UYARI | BLOKAJ
}

/** Bir elemanın çizim durumu (madde 8). */
export interface DrawingStateRef {
  drawingCode: string;
  /** Onaylı revizyon kodu; yoksa null. */
  approvedRevisionCode: string | null;
  /** Sahada kullanıldığı kaydedilen revizyon kodu; kaydedilmemişse null. */
  siteUsedRevisionCode: string | null;
}

export interface PileAcceptanceRef {
  totalPiles: number;
  acceptedPiles: number;
  /** Bu aktivite kazık kabulünü şart koşuyor mu? (proje şablonundan gelir) */
  required: boolean;
}

/** RFI Cevaplandı/Kapatıldı değilse bağlı iş bloke olur (madde 23). */
export function rfiBlockingReasons(rfis: OpenRFIRef[]): BlockingReason[] {
  return rfis
    .filter((r) => r.status !== "CEVAPLANDI" && r.status !== "KAPATILDI")
    .map((r) => ({
      code: "RFI_ACIK" as const,
      level: "BLOKAJ" as const,
      message: `${r.rfiNumber} numaralı RFI cevaplanmadı.`,
      responsible: "Teknik Ofis",
      nextAction: `${r.rfiNumber} cevabının alınması.`,
    }));
}

/** Hold Point tipi checkpoint GECTI değilse sonraki adım bloke. */
export function holdPointBlockingReasons(holdPoints: HoldPointRef[]): BlockingReason[] {
  return holdPoints
    .filter((h) => h.result !== "GECTI" && h.result !== "SARTLI_GECTI")
    .map((h) => ({
      code: "ITP_HOLD_POINT" as const,
      level: "BLOKAJ" as const,
      message: `"${h.checkpointName}" kontrol noktası serbest bırakılmadı.`,
      responsible: "QA/QC",
      nextAction: `"${h.checkpointName}" ITP kontrolünün yapılması.`,
    }));
}

/** FinishToStart: öncül aktivite tamamlanmadan ardıl başlayamaz. */
export function predecessorBlockingReasons(predecessors: PredecessorRef[]): BlockingReason[] {
  return predecessors
    .filter((p) => p.status !== "TAMAMLANDI" && p.status !== "IPTAL")
    .map((p) => ({
      code: "ONCUL_AKTIVITE" as const,
      level: "BLOKAJ" as const,
      message: `Öncül iş tamamlanmadı: ${p.name}`,
      responsible: "Saha",
      nextAction: `"${p.name}" işinin tamamlanması.`,
    }));
}

/**
 * NCR etkisi NCR bazında belirlenir (madde 7):
 * BLOKAJ → bloke sebebi, UYARI → uyarı, BILGILENDIRME → hiç listelenmez.
 */
export function ncrBlockingReasons(ncrs: NCRRef[]): BlockingReason[] {
  return ncrs
    .filter((n) => n.status !== "KAPATILDI")
    .filter((n) => n.impact === "BLOKAJ" || n.impact === "UYARI")
    .map((n) => ({
      code: "NCR_BLOKAJ" as const,
      level: (n.impact === "BLOKAJ" ? "BLOKAJ" : "UYARI") as BlockingLevel,
      message:
        n.impact === "BLOKAJ"
          ? `${n.ncrNumber} numaralı NCR açık ve bu iş için blokaj etkisi tanımlanmış.`
          : `${n.ncrNumber} numaralı NCR açık (uyarı etkili).`,
      responsible: "QA/QC",
      nextAction: `${n.ncrNumber} için düzeltici faaliyetin tamamlanıp NCR'ın kapatılması.`,
    }));
}

/**
 * Çizim readiness (madde 8): iş başlamadan önce
 * (a) geçerli onaylı çizim var mı, (b) sahadaki revizyon güncel mi.
 * Çizim ilişkilendirilmemişse hiçbir varsayım yapılmaz (liste boş döner).
 */
export function drawingBlockingReasons(drawings: DrawingStateRef[]): BlockingReason[] {
  const reasons: BlockingReason[] = [];
  for (const d of drawings) {
    if (!d.approvedRevisionCode) {
      reasons.push({
        code: "CIZIM_YOK",
        level: "BLOKAJ",
        message: `${d.drawingCode} için onaylı revizyon bulunmuyor.`,
        responsible: "Teknik Ofis",
        nextAction: `${d.drawingCode} çiziminin onaylı revizyonunun sisteme girilmesi.`,
      });
      continue;
    }
    if (!d.siteUsedRevisionCode) {
      reasons.push({
        code: "CIZIM_REVIZYON",
        level: "UYARI",
        message: `${d.drawingCode} için sahada kullanılan revizyon kaydedilmemiş.`,
        responsible: "Saha",
        nextAction: `Sahadaki nüshanın revizyonunun sisteme işlenmesi (onaylı: ${d.approvedRevisionCode}).`,
      });
      continue;
    }
    if (d.siteUsedRevisionCode !== d.approvedRevisionCode) {
      reasons.push({
        code: "CIZIM_REVIZYON",
        level: "BLOKAJ",
        message: `Şantiyede kullanılan çizim (${d.siteUsedRevisionCode}), son onaylı revizyondan (${d.approvedRevisionCode}) farklı: ${d.drawingCode}.`,
        responsible: "Teknik Ofis",
        nextAction: `${d.approvedRevisionCode} revizyonunun sahaya ulaştırılıp eski nüshanın toplanması.`,
      });
    }
  }
  return reasons;
}

/**
 * Kazık kabulü (madde 9): "tüm kazıklar kabul edildi" otomatik olarak "pier hazır" DEĞİLDİR.
 * Yalnızca bunu ön koşul olarak tanımlayan aktivite için bloke sebebi üretir.
 */
export function pileAcceptanceBlockingReasons(ref: PileAcceptanceRef | null): BlockingReason[] {
  if (!ref || !ref.required) return [];
  const pending = ref.totalPiles - ref.acceptedPiles;
  if (pending <= 0) return [];
  return [
    {
      code: "KAZIK_KABUL",
      level: "BLOKAJ",
      message: `${pending} kazığın kabulü tamamlanmadı (${ref.acceptedPiles}/${ref.totalPiles}).`,
      responsible: "QA/QC",
      nextAction: "Kalan kazıkların test ve kabul kayıtlarının tamamlanması.",
    },
  ];
}

/** Yalnızca gerçek blokajlar (uyarılar hariç). */
export function onlyBlocking(reasons: BlockingReason[]): BlockingReason[] {
  return reasons.filter((r) => r.level === "BLOKAJ");
}

export const BLOCKING_LEVEL_LABELS: Record<BlockingLevel, string> = {
  BLOKAJ: "Blokaj",
  UYARI: "Uyarı",
  BILGI: "Bilgi",
};
