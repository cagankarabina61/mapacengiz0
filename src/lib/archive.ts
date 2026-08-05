// Arşiv filtresi — tek doğru kaynak (§49/§51).
//
// SEMANTİK: Arşivleme "aktif listelerden ve seçim kutularından gizle" demektir,
// "geçmişi sil" DEMEZ. §49 açıkça "VERİYİ SESSİZCE YOK ETME" diyor.
//
// Bu yüzden AKTIF filtresi YALNIZCA şu iki yerde uygulanır:
//   1) Liste sayfaları (/yapilar, /yapilar/[kod] eleman listesi)
//   2) Seçim kutuları ve filtre pilleri (beton/yeni, ncr, rfi, cizimler,
//      dokumanlar, qaqc, kazik yapı filtresi, Excel import hedef çözümleme)
//
// UYGULANMAZ (geçmiş üretim verisi görünmeye devam eder):
//   reports.ts, planning.ts, blocking.ts, readiness.ts
//
// Global arama (/ara) arşivlileri gösterir ama "Arşivli" rozetiyle işaretler.

/** Arşivlenmemiş kayıt filtresi. Prisma `where` içine yayılarak kullanılır. */
export const AKTIF = { archivedAt: null } as const;

/** Arşivli mi? (UI rozetleri için) */
export function isArchived(record: { archivedAt: Date | null }): boolean {
  return record.archivedAt !== null;
}
