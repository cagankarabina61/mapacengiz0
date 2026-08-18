import { describe, it, expect } from "vitest";
import { SECTIONS, SECTION_ENTITY_TYPE, sectionTitle, noteKey } from "@/lib/sections";

describe("BÖLÜM ANAHTARLARI", () => {
  const keys = Object.keys(SECTIONS);

  it("her bölümün boş olmayan Türkçe etiketi vardır", () => {
    for (const k of keys) {
      expect(sectionTitle(k as keyof typeof SECTIONS).trim().length).toBeGreaterThan(0);
    }
  });

  it("anahtarlar 'sayfa.bolum' biçimindedir", () => {
    for (const k of keys) expect(k).toMatch(/^[a-z]+\.[a-z]+$/);
  });

  it("anahtarlar benzersizdir", () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("bölüm notları kayıt notlarından ayrı bir entityType kullanır", () => {
    // "Section" hiçbir Prisma modeliyle çakışmamalı.
    expect(SECTION_ENTITY_TYPE).toBe("Section");
    expect(noteKey(SECTION_ENTITY_TYPE, "bugun.beton")).toBe("Section:bugun.beton");
  });
});
