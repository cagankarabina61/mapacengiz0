// Kaynak çakışma tespiti ve sınıflandırması (madde 4).
// Seviyeler: BILGI (temas/ardışık), UYARI (bölünebilir kaynak kesişimi),
// KRITIK (fiziksel olarak aynı anda iki yerde olamayan kaynak kesişimi).
// Kritik çakışma kaydı ENGELLEMEZ; yetkili kullanıcı gerekçeyle override eder (audit'e yazılır).

export type ConflictSeverity = "BILGI" | "UYARI" | "KRITIK";

export interface BookingInterval {
  id?: string;
  resourceId: string;
  startDateTime: Date;
  endDateTime: Date;
  targetLabel?: string;
  /** Kaynağın adı/kodu — mesajda gösterilir. */
  resourceLabel?: string;
  /** Fiziksel olarak aynı anda tek yerde olabilen kaynak mı? */
  isPhysicallyExclusive?: boolean;
  /** Bu rezervasyon için kritik çakışma daha önce kabul edildi mi? */
  conflictOverride?: boolean;
}

export interface ConflictWarning {
  resourceId: string;
  severity: ConflictSeverity;
  existing: BookingInterval;
  incoming: BookingInterval;
  message: string;
  /** Çakışan sürenin dakika cinsinden uzunluğu (0 = yalnızca temas). */
  overlapMinutes: number;
  /** Override edilmişse kritik çakışma kabul edilmiş sayılır. */
  overridden: boolean;
}

/** İki aralığın kesişim süresi (dakika). Bitişik aralıklar 0 döner. */
export function overlapMinutes(a: BookingInterval, b: BookingInterval): number {
  const start = Math.max(a.startDateTime.getTime(), b.startDateTime.getTime());
  const end = Math.min(a.endDateTime.getTime(), b.endDateTime.getTime());
  return end > start ? Math.round((end - start) / 60000) : 0;
}

// VARSAYIM (konfigüre edilebilir): 15 dakikadan kısa kesişme, saha koşullarında
// tolere edilebilir kabul edilip BILGI seviyesine düşürülür.
export const MINOR_OVERLAP_MINUTES = 15;

function classify(
  incoming: BookingInterval,
  existing: BookingInterval,
  minutes: number
): ConflictSeverity {
  // Fiziksel münhasırlık bilgisi yoksa güvenli taraf: münhasır kabul edilir.
  const exclusive = (incoming.isPhysicallyExclusive ?? true) && (existing.isPhysicallyExclusive ?? true);
  if (!exclusive) return minutes <= MINOR_OVERLAP_MINUTES ? "BILGI" : "UYARI";
  return minutes <= MINOR_OVERLAP_MINUTES ? "UYARI" : "KRITIK";
}

function buildMessage(
  severity: ConflictSeverity,
  incoming: BookingInterval,
  existing: BookingInterval,
  minutes: number
): string {
  const name = incoming.resourceLabel ?? existing.resourceLabel ?? "Kaynak";
  const other = existing.targetLabel ? ` (çakışan iş: ${existing.targetLabel})` : "";
  const dur = minutes > 0 ? ` ${minutes} dakika örtüşüyor.` : " Aralıklar bitişik.";
  switch (severity) {
    case "KRITIK":
      return `KRİTİK ÇAKIŞMA — ${name} aynı anda iki farklı işte planlanmış; fiziksel olarak mümkün değil${other}.${dur}`;
    case "UYARI":
      return `UYARI — ${name} için zaman çakışması var${other}.${dur}`;
    default:
      return `BİLGİ — ${name} programı sıkışık${other}.${dur}`;
  }
}

/** Çakışan rezervasyonları seviyelendirerek döner. En kritik önce sıralanır. */
export function findConflicts(
  incoming: BookingInterval,
  existingBookings: BookingInterval[]
): ConflictWarning[] {
  const order: Record<ConflictSeverity, number> = { KRITIK: 0, UYARI: 1, BILGI: 2 };
  return existingBookings
    .filter(
      (b) =>
        b.resourceId === incoming.resourceId &&
        b.id !== incoming.id &&
        incoming.startDateTime < b.endDateTime &&
        incoming.endDateTime > b.startDateTime
    )
    .map((b) => {
      const minutes = overlapMinutes(incoming, b);
      const severity = classify(incoming, b, minutes);
      return {
        resourceId: incoming.resourceId,
        severity,
        existing: b,
        incoming,
        message: buildMessage(severity, incoming, b, minutes),
        overlapMinutes: minutes,
        overridden: !!(incoming.conflictOverride || b.conflictOverride),
      };
    })
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Listedeki en yüksek seviye (risk motoruna girdi). */
export function highestSeverity(conflicts: ConflictWarning[]): "YOK" | ConflictSeverity {
  const active = conflicts.filter((c) => !c.overridden);
  if (active.some((c) => c.severity === "KRITIK")) return "KRITIK";
  if (active.some((c) => c.severity === "UYARI")) return "UYARI";
  if (active.length > 0) return "BILGI";
  return "YOK";
}

export const CONFLICT_SEVERITY_LABELS: Record<ConflictSeverity, string> = {
  BILGI: "Bilgilendirici",
  UYARI: "Uyarı",
  KRITIK: "Kritik",
};
