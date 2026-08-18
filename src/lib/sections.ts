// Bölüm anahtarları — her ekran bölümünün kalıcı kimliği.
//
// Bölüm notları Note tablosunda entityType = "Section", entityId = SectionKey
// olarak saklanır. Böylece ayrı bir tablo/indeks gerekmez; Note üzerindeki
// @@index([entityType, entityId, status]) yeniden kullanılır.
//
// Yeni bir bölüm eklerken buraya da eklenmelidir — SectionKey union'ı
// yazım hatalarını derleme zamanında yakalar.

export const SECTIONS = {
  // Panel (ana sayfa)
  "panel.dikkat": "Bugün Dikkat Gerektiren İşler",
  "panel.beton": "Bugünün Betonları",
  "panel.bloke": "Bloke İşler",

  // Bugün
  "bugun.beton": "Beton Dökümleri",
  "bugun.isler": "Planlanan İşler",
  "bugun.segment": "Segment İşleri",
  "bugun.geciken": "Geciken İşler",
  "bugun.ekip": "Ekip Bazlı Görünüm",

  // Diğer saha sayfaları
  "beton.liste": "Beton Dökümleri",
  "bloke.liste": "Bloke İşler",
  "bloke.uyari": "Uyarılar",
  "yapilar.liste": "Yapılar",
  "planlama.gantt": "Planlama",
} as const;

export type SectionKey = keyof typeof SECTIONS;

/** Note.entityType değeri — bölüm notlarını kayıt notlarından ayırır. */
export const SECTION_ENTITY_TYPE = "Section";

export function sectionTitle(key: SectionKey): string {
  return SECTIONS[key];
}

/** attachNotes/getNotesForKeys içinde kullanılan gruplama anahtarı. */
export function noteKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}
