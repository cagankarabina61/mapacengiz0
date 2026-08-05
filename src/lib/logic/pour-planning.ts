// Beton döküm planlama hesabı (madde 10).
// Amaç: hacim + pompa kapasitesi + hazırlık/temizlik payı ile GERÇEKÇİ bir zaman penceresi
// üretmek. TAM LOJİSTİK OPTİMİZASYONU YAPILMAZ (transmikser turu, santral kuyruğu,
// yol süresi modellenmez) — bu bilinçli bir MVP sınırıdır.

export interface PourDurationInput {
  plannedVolumeM3: number;
  /** Pompa kapasitesi (m³/saat). Bilinmiyorsa null → süre hesaplanamaz. */
  pumpCapacityM3PerHour?: number | null;
  /** Kullanıcının elle girdiği süre (dakika) — varsa hesabı geçersiz kılar. */
  overrideDurationMin?: number | null;
}

export interface PourDurationResult {
  /** Tahmini toplam süre (dakika). Hesaplanamıyorsa null. */
  durationMin: number | null;
  /** Hesap açıklaması — kullanıcı neye dayandığını görsün. */
  explanation: string;
  /** Elle mi girildi? */
  isOverride: boolean;
}

// VARSAYIM (konfigüre edilebilir sabitler): hazırlık + pompa kurulumu 30 dk,
// döküm sonrası temizlik/söküm 30 dk. Gerçek değerler projeye göre değişebilir.
export const POUR_SETUP_MIN = 30;
export const POUR_CLEANUP_MIN = 30;
/** Pompanın nominal kapasitesinin sahada gerçekleşen oranı (saha verimliliği). */
export const PUMP_EFFICIENCY = 0.7;

export function estimatePourDuration(input: PourDurationInput): PourDurationResult {
  if (input.overrideDurationMin != null && input.overrideDurationMin > 0) {
    return {
      durationMin: Math.round(input.overrideDurationMin),
      explanation: "Süre kullanıcı tarafından elle girildi.",
      isOverride: true,
    };
  }
  const capacity = input.pumpCapacityM3PerHour ? Number(input.pumpCapacityM3PerHour) : null;
  if (!capacity || capacity <= 0 || !input.plannedVolumeM3 || input.plannedVolumeM3 <= 0) {
    return {
      durationMin: null,
      explanation:
        "Süre hesaplanamadı: pompa kapasitesi veya planlanan hacim tanımlı değil. " +
        "Pompa seçilmeli ya da süre elle girilmelidir.",
      isOverride: false,
    };
  }
  const effective = capacity * PUMP_EFFICIENCY;
  const pumpingMin = (input.plannedVolumeM3 / effective) * 60;
  const total = Math.ceil(pumpingMin + POUR_SETUP_MIN + POUR_CLEANUP_MIN);
  return {
    durationMin: total,
    explanation:
      `${input.plannedVolumeM3} m³ ÷ (${capacity} m³/sa × %${Math.round(PUMP_EFFICIENCY * 100)} verim) ` +
      `= ${Math.round(pumpingMin)} dk döküm + ${POUR_SETUP_MIN} dk hazırlık + ${POUR_CLEANUP_MIN} dk temizlik.`,
    isOverride: false,
  };
}

export interface PourWindow {
  start: Date;
  end: Date;
  /** Süre bilinmiyorsa varsayılan pencere kullanıldı mı? */
  durationKnown: boolean;
}

// Süre hesaplanamadığında rezervasyon için kullanılan varsayılan pencere.
export const FALLBACK_POUR_DURATION_MIN = 240;

/** Planlanan tarih + saat + süreden döküm penceresi üretir (kaynak rezervasyonu için). */
export function pourWindow(
  plannedDate: Date,
  plannedTime: string | null,
  durationMin: number | null
): PourWindow {
  const start = new Date(plannedDate);
  if (plannedTime) {
    const [h, m] = plannedTime.split(":").map(Number);
    if (!Number.isNaN(h)) start.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
  }
  const minutes = durationMin && durationMin > 0 ? durationMin : FALLBACK_POUR_DURATION_MIN;
  return {
    start,
    end: new Date(start.getTime() + minutes * 60000),
    durationKnown: !!(durationMin && durationMin > 0),
  };
}

/** Süreyi "3 sa 20 dk" biçiminde gösterir. */
export function formatDuration(min: number | null): string {
  if (!min || min <= 0) return "Belirtilmemiş";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}
