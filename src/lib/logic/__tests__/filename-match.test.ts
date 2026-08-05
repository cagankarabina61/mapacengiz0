// Dosya adı otomatik eşleştirme testleri (madde 51).
import { describe, it, expect } from "vitest";
import { parseDrawingFilename, matchElementCode } from "../filename-match";

const STRUCTURES = ["VIA-10", "VIA-11", "VIA-12"];

describe("parseDrawingFilename", () => {
  it("madde 51 örneği: VIA11_P05_REBAR_REV04.pdf", () => {
    const s = parseDrawingFilename("VIA11_P05_REBAR_REV04.pdf", STRUCTURES);
    expect(s.structureCode).toBe("VIA-11");
    expect(s.elementToken).toBe("P5");
    expect(s.revisionCode).toBe("Rev.04");
    expect(s.disciplineToken).toBe("REBAR");
  });

  it("tire ve küçük harf varyasyonları", () => {
    const s = parseDrawingFilename("via-10-p3-formwork-rev2.pdf", STRUCTURES);
    expect(s.structureCode).toBe("VIA-10");
    expect(s.elementToken).toBe("P3");
    expect(s.revisionCode).toBe("Rev.02");
  });

  it("eşleşmeyen yapı kodu null döner — uydurma yok (madde 49)", () => {
    const s = parseDrawingFilename("VIA99_P01_REV01.pdf", STRUCTURES);
    expect(s.structureCode).toBeNull();
    expect(s.elementToken).toBe("P1");
  });

  it("abutment token'ı", () => {
    const s = parseDrawingFilename("VIA11_A2_BEARING_REV01.pdf", STRUCTURES);
    expect(s.elementToken).toBe("A2");
  });
});

describe("matchElementCode", () => {
  const CODES = ["VIA11-P05", "VIA11-P05-PC", "VIA11-A1", "VIA11-P12"];

  it("P5 → VIA11-P05 (sıfır dolgusu fark etmez)", () => {
    expect(matchElementCode("P5", CODES)).toBe("VIA11-P05");
  });

  it("P12 → VIA11-P12", () => {
    expect(matchElementCode("P12", CODES)).toBe("VIA11-P12");
  });

  it("A1 → VIA11-A1", () => {
    expect(matchElementCode("A1", CODES)).toBe("VIA11-A1");
  });

  it("eşleşme yoksa null", () => {
    expect(matchElementCode("P99", CODES)).toBeNull();
  });
});
