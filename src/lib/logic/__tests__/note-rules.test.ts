import { describe, it, expect } from "vitest";
import { canEditNote, canEditAttentionItem } from "../note-rules";

const saha = { id: "u-saha", role: "SAHA_MUHENDISI" as const };
const qaqc = { id: "u-qaqc", role: "QAQC" as const };
const yonetici = { id: "u-yon", role: "YONETICI" as const };
const izleyici = { id: "u-izl", role: "IZLEYICI" as const };

const note = (authorId: string, deletedAt: Date | null = null) => ({ authorId, deletedAt });

describe("NOT SAHİPLİĞİ — düzenleme hakkı", () => {
  it("yazar kendi notunu düzenleyebilir", () => {
    expect(canEditNote(note("u-saha"), saha)).toBe(true);
  });

  it("yönetici herkesin notunu düzenleyebilir", () => {
    expect(canEditNote(note("u-saha"), yonetici)).toBe(true);
  });

  it("başka bir rol, sahanın notunu düzenleyemez", () => {
    expect(canEditNote(note("u-saha"), qaqc)).toBe(false);
  });

  it("izleyici, kendi id'sini taşıyan notu bile düzenleyemez", () => {
    // Derinlemesine savunma: izleyici zaten not oluşturamaz.
    expect(canEditNote(note("u-izl"), izleyici)).toBe(false);
  });

  it("yumuşak silinmiş not kimse tarafından düzenlenemez", () => {
    const silinmis = note("u-saha", new Date("2026-08-18T00:00:00Z"));
    expect(canEditNote(silinmis, saha)).toBe(false);
    expect(canEditNote(silinmis, yonetici)).toBe(false);
  });
});

describe("ELLE DİKKAT KALEMİ — düzenleme hakkı", () => {
  it("ekleyen kişi kendi kalemini kapatabilir", () => {
    expect(canEditAttentionItem({ createdById: "u-saha" }, saha)).toBe(true);
  });

  it("yönetici herkesin kalemini kapatabilir", () => {
    expect(canEditAttentionItem({ createdById: "u-saha" }, yonetici)).toBe(true);
  });

  it("başkasının kalemi kapatılamaz", () => {
    expect(canEditAttentionItem({ createdById: "u-saha" }, qaqc)).toBe(false);
  });

  it("izleyici hiçbir kalemi kapatamaz", () => {
    expect(canEditAttentionItem({ createdById: "u-izl" }, izleyici)).toBe(false);
  });
});
