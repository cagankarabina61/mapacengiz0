import { describe, it, expect } from "vitest";
import {
  manualRisk,
  isAttentionItemActive,
  mergeAttentionItems,
  validUntilFor,
  type AttentionSource,
} from "../attention";
import { RISK_RULES } from "../risk";

const item = (source: AttentionSource, score: number, id: string) => ({
  id,
  source,
  risk: { score },
});

describe("KATMANLI DÜZENLEME — elle eklenen dikkat kalemi riski", () => {
  it("seviyeden sentetik puan üretir", () => {
    expect(manualRisk("DUSUK").score).toBe(1);
    expect(manualRisk("ORTA").score).toBe(3);
    expect(manualRisk("YUKSEK").score).toBe(6);
  });

  it("seviyeyi olduğu gibi korur (sistem eşiklerine yeniden sokmaz)", () => {
    expect(manualRisk("DUSUK").level).toBe("DUSUK");
    expect(manualRisk("YUKSEK").level).toBe("YUKSEK");
  });

  it("tek bir gösterim faktörü taşır ve hiç kural değerlendirmez", () => {
    const r = manualRisk("ORTA");
    expect(r.factors).toHaveLength(1);
    expect(r.factors[0].key).toBe("ELLE_EKLENDI");
    expect(r.evaluatedRuleCount).toBe(0);
  });

  // Regresyon nöbetçisi: sentetik faktör gerçek kural setine SIZMAMALI.
  it("ELLE_EKLENDI gerçek RISK_RULES kataloğunda yer almaz", () => {
    expect(RISK_RULES.every((r) => r.key !== "ELLE_EKLENDI")).toBe(true);
  });
});

describe("KATMANLI DÜZENLEME — geçerlilik penceresi", () => {
  const now = new Date("2026-08-18T10:00:00Z");
  const base = { status: "ACIK", validFrom: new Date("2026-08-18T06:00:00Z") };

  it("süresiz kalem aktiftir", () => {
    expect(isAttentionItemActive({ ...base, validUntil: null }, now)).toBe(true);
  });

  it("süresi dolmuş kalem düşer", () => {
    expect(
      isAttentionItemActive({ ...base, validUntil: new Date("2026-08-17T23:59:59Z") }, now)
    ).toBe(false);
  });

  it("henüz başlamamış kalem görünmez", () => {
    expect(
      isAttentionItemActive(
        { status: "ACIK", validFrom: new Date("2026-08-19T06:00:00Z"), validUntil: null },
        now
      )
    ).toBe(false);
  });

  it("çözülmüş kalem görünmez", () => {
    expect(isAttentionItemActive({ ...base, status: "COZULDU", validUntil: null }, now)).toBe(
      false
    );
  });

  it("validUntil tam olarak şimdiye eşitse hâlâ aktiftir", () => {
    expect(isAttentionItemActive({ ...base, validUntil: new Date(now) }, now)).toBe(true);
  });

  it("Bugün seçimi günün son anına, Yarın ertesi günün son anına ayarlanır", () => {
    const t = new Date("2026-08-18T10:00:00");
    const bugun = validUntilFor("BUGUN", t)!;
    const yarin = validUntilFor("YARIN", t)!;
    expect(bugun.getDate()).toBe(18);
    expect(bugun.getHours()).toBe(23);
    expect(yarin.getDate()).toBe(19);
    expect(validUntilFor("SURESIZ", t)).toBeNull();
  });
});

describe("KATMANLI DÜZENLEME — sistem + elle birleştirme", () => {
  it("elle kalem sistemin risk<3 eşiğine takılmaz", () => {
    const merged = mergeAttentionItems([item("SISTEM", 5, "s1")], [item("ELLE", 1, "e1")]);
    expect(merged.map((m) => m.id)).toContain("e1");
  });

  it("risk puanına göre azalan sıralar", () => {
    const merged = mergeAttentionItems(
      [item("SISTEM", 3, "s1"), item("SISTEM", 8, "s2")],
      [item("ELLE", 6, "e1")]
    );
    expect(merged.map((m) => m.id)).toEqual(["s2", "e1", "s1"]);
  });

  it("puan eşitse kullanıcının kendi kalemi üstte olur", () => {
    const merged = mergeAttentionItems([item("SISTEM", 3, "s1")], [item("ELLE", 3, "e1")]);
    expect(merged[0].id).toBe("e1");
  });

  it("hiç elle kalem yoksa sistem listesi olduğu gibi kalır", () => {
    const merged = mergeAttentionItems([item("SISTEM", 4, "s1"), item("SISTEM", 9, "s2")], []);
    expect(merged.map((m) => m.id)).toEqual(["s2", "s1"]);
  });
});
