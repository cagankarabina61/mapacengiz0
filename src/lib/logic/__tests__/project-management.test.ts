// Proje/VIA yönetimi saf mantık testleri (§43/§52/§58/§59).
import { describe, it, expect } from "vitest";
import {
  normalizeStructureCode,
  isValidStructureCode,
  compareStructureCodes,
  buildElementCode,
  buildPileCode,
  buildSegmentCode,
} from "../structure-codes";
import { buildPierSetupPreview } from "../pier-setup";

describe("§43/§59 — Yapı kodu normalize + doğal sıralama", () => {
  it("farklı yazımları tek biçime getirir", () => {
    expect(normalizeStructureCode("via 11")).toBe("VIA-11");
    expect(normalizeStructureCode("VIA11")).toBe("VIA-11");
    expect(normalizeStructureCode("  via_11 ")).toBe("VIA-11");
    expect(normalizeStructureCode("VIA-011")).toBe("VIA-11"); // baştaki sıfırlar atılır
  });

  it("tanınmayan biçimi yeniden yazmaz, sadece toparlar", () => {
    expect(normalizeStructureCode("köprü A")).toBe("KÖPRÜ-A");
  });

  it("geçerlilik kontrolü", () => {
    expect(isValidStructureCode("VIA-11")).toBe(true);
    expect(isValidStructureCode("V")).toBe(false); // çok kısa
    expect(isValidStructureCode("VIA 11")).toBe(false); // boşluk kalmamalı
    expect(isValidStructureCode("-VIA")).toBe(false); // tire ile başlayamaz
  });

  it("alfabetik değil SAYISAL sıralar (VIA-2 < VIA-10)", () => {
    const codes = ["VIA-11", "VIA-1", "VIA-48", "VIA-2", "VIA-10"];
    expect([...codes].sort(compareStructureCodes)).toEqual([
      "VIA-1",
      "VIA-2",
      "VIA-10",
      "VIA-11",
      "VIA-48",
    ]);
  });

  it("farklı önekler kendi arasında gruplanır, sayısız kodlar sona gider", () => {
    const codes = ["VIA-2", "KOP-1", "VIA-1", "MENFEZ"];
    expect([...codes].sort(compareStructureCodes)).toEqual(["KOP-1", "MENFEZ", "VIA-1", "VIA-2"]);
  });
});

describe("§61 — Kod üretimi hard-code içermez, her yapı için aynı çalışır", () => {
  it("eleman/kazık/segment kodları", () => {
    expect(buildElementCode("VIA-11", "PIER", 5)).toBe("VIA11-P05");
    expect(buildElementCode("VIA-48", "PIER", 12)).toBe("VIA48-P12");
    expect(buildElementCode("VIA-3", "ABUTMENT", 1)).toBe("VIA3-A01");
    expect(buildPileCode("VIA11-P05", 3)).toBe("VIA11-P05-PILE-03");
    expect(buildSegmentCode("VIA11-P05", "SOL", 7)).toBe("VIA11-P05-SEG-L07");
    expect(buildSegmentCode("VIA11-P05", "SAG", 0)).toBe("VIA11-P05-SEG-R00");
  });
});

describe("§52 — Pier kurulum önizlemesi", () => {
  const steps = { pileCap: ["Kazı", "Donatı", "Beton"], pierBody: ["Donatı", "Beton"] };

  it("kazık sayısı kadar kazık kaydı üretir", () => {
    const p = buildPierSetupPreview(
      {
        structureCode: "VIA-16",
        pierNumber: 3,
        pileCount: 16,
        hasBalancedCantilever: false,
        createActivities: false,
      },
      steps
    );
    expect(p.pierCode).toBe("VIA16-P03");
    expect(p.records.filter((r) => r.category === "Kazık")).toHaveLength(16);
    expect(p.records.filter((r) => r.category === "Kazık Grubu")).toHaveLength(1);
    // Pier + Pile Cap + Gövde + kazık grubu + 16 kazık
    expect(p.total).toBe(1 + 2 + 1 + 16);
  });

  it("dengeli konsol seçiliyse iki taraf için (N+1)×2 segment üretir", () => {
    const p = buildPierSetupPreview(
      {
        structureCode: "VIA-11",
        pierNumber: 5,
        pileCount: 0,
        hasBalancedCantilever: true,
        segmentCount: 8,
        createActivities: false,
      },
      steps
    );
    const segs = p.records.filter((r) => r.category === "Dengeli Konsol Segmenti");
    expect(segs).toHaveLength(2 * 9); // S0..S8 = 9 adet, sol+sağ
    expect(segs.some((s) => s.code === "VIA11-P05-SEG-L00")).toBe(true);
    expect(segs.some((s) => s.code === "VIA11-P05-SEG-R08")).toBe(true);
  });

  it("dengeli konsol kapalıysa HİÇ segment üretilmez", () => {
    const p = buildPierSetupPreview(
      {
        structureCode: "VIA-11",
        pierNumber: 5,
        pileCount: 4,
        hasBalancedCantilever: false,
        segmentCount: 8, // seçilmediği için yok sayılır
        createActivities: false,
      },
      steps
    );
    expect(p.records.filter((r) => r.category === "Dengeli Konsol Segmenti")).toHaveLength(0);
  });

  it("dengeli konsol seçili ama segment sayısı yoksa uyarır, segment üretmez", () => {
    const p = buildPierSetupPreview(
      {
        structureCode: "VIA-11",
        pierNumber: 6,
        pileCount: 0,
        hasBalancedCantilever: true,
        createActivities: false,
      },
      steps
    );
    expect(p.records.filter((r) => r.category === "Dengeli Konsol Segmenti")).toHaveLength(0);
    expect(p.warnings.some((w) => w.includes("segment sayısı girilmedi"))).toBe(true);
  });

  it("iş kalemleri şablondan gelir; şablon boşsa uyarır ve üretmez (varsayım yok)", () => {
    const withSteps = buildPierSetupPreview(
      {
        structureCode: "VIA-11",
        pierNumber: 7,
        pileCount: 0,
        hasBalancedCantilever: false,
        createActivities: true,
      },
      steps
    );
    expect(withSteps.records.filter((r) => r.category === "İş Kalemi")).toHaveLength(5);

    const noSteps = buildPierSetupPreview(
      {
        structureCode: "VIA-11",
        pierNumber: 7,
        pileCount: 0,
        hasBalancedCantilever: false,
        createActivities: true,
      },
      { pileCap: [], pierBody: [] }
    );
    expect(noSteps.records.filter((r) => r.category === "İş Kalemi")).toHaveLength(0);
    expect(noSteps.warnings.some((w) => w.includes("şablonu tanımlı değil"))).toBe(true);
  });

  it("kazık çapı/boyu girilmediyse uydurmaz, uyarır", () => {
    const p = buildPierSetupPreview(
      {
        structureCode: "VIA-20",
        pierNumber: 1,
        pileCount: 2,
        hasBalancedCantilever: false,
        createActivities: false,
      },
      steps
    );
    expect(p.records.find((r) => r.category === "Kazık")?.detail).toBe("Çap/boy belirtilmemiş");
    expect(p.warnings.some((w) => w.includes("çapı"))).toBe(true);
  });

  it("özet kategori bazlı sayım verir", () => {
    const p = buildPierSetupPreview(
      {
        structureCode: "VIA-16",
        pierNumber: 3,
        pileCount: 4,
        hasBalancedCantilever: false,
        createActivities: false,
      },
      steps
    );
    expect(p.summary).toEqual(
      expect.arrayContaining([
        { category: "Pier", count: 1 },
        { category: "Alt Eleman", count: 2 },
        { category: "Kazık", count: 4 },
      ])
    );
  });
});
