// Tüm enum → Türkçe etiket eşlemeleri (madde 2: UI tamamen Türkçe).
// Tek doğru kaynak: UI hiçbir yerde ham enum değeri göstermez.

export const ELEMENT_STATUS_LABELS: Record<string, string> = {
  PLANLANMADI: "Planlanmadı",
  PLANLANDI: "Planlandı",
  BASLANMADI: "Başlanmadı",
  DEVAM_EDIYOR: "Devam Ediyor",
  KONTROL_BEKLIYOR: "Kontrol Bekliyor",
  ONAY_BEKLIYOR: "Onay Bekliyor",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
};

// Aktivite durumları — Planlandı / Başlanabilir / İmalata Hazır ayrı kavramlardır (madde 6)
export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  PLANLANMADI: "Planlanmadı",
  PLANLANDI: "Planlandı",
  BASLANABILIR: "Başlanabilir",
  IMALATA_HAZIR: "İmalata Hazır",
  DEVAM_EDIYOR: "Devam Ediyor",
  KONTROL_BEKLIYOR: "Kontrol Bekliyor",
  ONAY_BEKLIYOR: "Onay Bekliyor",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
};

export const POUR_STATUS_LABELS: Record<string, string> = {
  PLANLANDI: "Planlandı",
  HAZIR_DEGIL: "Hazır Değil",
  BASLANABILIR: "Başlanabilir",
  BETON_DOKUMUNE_HAZIR: "Beton Dökümüne Hazır",
  BETON_DOKULUYOR: "Beton Dökülüyor",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
};

export const NCR_IMPACT_LABELS: Record<string, string> = {
  BILGILENDIRME: "Bilgilendirme",
  UYARI: "Uyarı",
  BLOKAJ: "Blokaj",
};

export const PILE_STATUS_LABELS: Record<string, string> = {
  PLANLANDI: "Planlandı",
  DELGI_BEKLIYOR: "Delgi Bekliyor",
  DELGI_DEVAM_EDIYOR: "Delgi Devam Ediyor",
  DELGI_TAMAMLANDI: "Delgi Tamamlandı",
  DONATI_KAFESI_HAZIRLANIYOR: "Donatı Kafesi Hazırlanıyor",
  DONATI_KAFESI_HAZIR: "Donatı Kafesi Hazır",
  BETON_BEKLIYOR: "Beton Bekliyor",
  BETONLANDI: "Betonlandı",
  TEST_BEKLIYOR: "Test Bekliyor",
  TEST_YAPILDI: "Test Yapıldı",
  KABUL_EDILDI: "Kabul Edildi",
  PROBLEMLI: "Problemli",
};

export const SEGMENT_STATUS_LABELS: Record<string, string> = {
  PLANLANMADI: "Planlanmadı",
  PLANLANDI: "Planlandı",
  BASLANABILIR: "Başlanabilir",
  DEVAM_EDIYOR: "Devam Ediyor",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
};

export const STEP_STATUS_LABELS: Record<string, string> = {
  BEKLIYOR: "Bekliyor",
  DEVAM_EDIYOR: "Devam Ediyor",
  TAMAMLANDI: "Tamamlandı",
};

export const CHECK_STATUS_LABELS: Record<string, string> = {
  BEKLIYOR: "Bekliyor",
  TAMAMLANDI: "Tamamlandı",
};

export const RFI_STATUS_LABELS: Record<string, string> = {
  TASLAK: "Taslak",
  GONDERILDI: "Gönderildi",
  CEVAP_BEKLENIYOR: "Cevap Bekleniyor",
  CEVAPLANDI: "Cevaplandı",
  KAPATILDI: "Kapatıldı",
};

export const NCR_STATUS_LABELS: Record<string, string> = {
  ACIK: "Açık",
  DUZELTME_YAPILIYOR: "Düzeltme Yapılıyor",
  KAPATILDI: "Kapatıldı",
};

export const ROLE_LABELS: Record<string, string> = {
  YONETICI: "Yönetici",
  TEKNIK_OFIS: "Teknik Ofis",
  SAHA_MUHENDISI: "Saha Mühendisi",
  QAQC: "QA/QC",
  SURVEY: "Survey",
  IZLEYICI: "İzleyici",
};

export const ELEMENT_TYPE_LABELS: Record<string, string> = {
  ABUTMENT: "Abutment",
  PIER: "Pier",
  PILE_CAP: "Pile Cap",
  PIER_GOVDESI: "Pier Gövdesi",
  BASLIK: "Başlık",
  BEARING: "Bearing",
  DIGER: "Diğer",
};

export const STRUCTURE_TYPE_LABELS: Record<string, string> = {
  VIYADUK: "Viyadük",
  KOPRU: "Köprü",
  ALT_GECIT: "Alt Geçit",
  UST_GECIT: "Üst Geçit",
  MENFEZ: "Menfez",
  DIGER: "Diğer",
};

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  POMPA: "Pompa",
  VINC: "Vinç",
  KALIP_EKIBI: "Kalıp Ekibi",
  DONATI_EKIBI: "Donatı Ekibi",
  BETON_EKIBI: "Beton Ekibi",
  SURVEY_EKIBI: "Survey Ekibi",
  QAQC_EKIBI: "QA/QC Ekibi",
  DIGER: "Diğer",
};

export const PILE_TEST_STATUS_LABELS: Record<string, string> = {
  BEKLIYOR: "Bekliyor",
  YAPILDI: "Yapıldı",
};

export const PILE_ACCEPTANCE_LABELS: Record<string, string> = {
  BEKLIYOR: "Bekliyor",
  KABUL: "Kabul Edildi",
  RED: "Reddedildi",
};

export const OVERALL_LABELS: Record<string, string> = {
  TAMAMLANDI: "Tamamlandı",
  BLOKE: "Bloke",
  RISKLI: "Riskli",
  DEVAM_EDIYOR: "Devam Ediyor",
};

export const RISK_LEVEL_LABELS_TR: Record<string, string> = {
  DUSUK: "Düşük",
  ORTA: "Orta",
  YUKSEK: "Yüksek",
};

/** Bilinmeyen/boş değerler için (madde 49): asla uydurma, "Belirtilmemiş" göster. */
export const UNSPECIFIED = "Belirtilmemiş";

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return UNSPECIFIED;
  return map[key] ?? key;
}
