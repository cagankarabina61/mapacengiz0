// Rapor sorguları (madde 46). Tümü canlı veri; plan ve gerçek değerler ayrı sütunlarda (madde 70).
import { prisma } from "@/lib/db";
import { dayRange } from "@/lib/services/dashboard";
import { pourTargetLabel } from "@/lib/services/pours";
import {
  POUR_STATUS_LABELS,
  PILE_STATUS_LABELS,
  PILE_TEST_STATUS_LABELS,
  PILE_ACCEPTANCE_LABELS,
  ELEMENT_STATUS_LABELS,
  RFI_STATUS_LABELS,
  NCR_STATUS_LABELS,
  UNSPECIFIED,
  label,
} from "@/lib/labels";

export interface ReportDef {
  key: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("tr-TR") : "—");
const fmtNum = (v: unknown) => (v === null || v === undefined ? "—" : Number(v));

export async function betonRaporu(): Promise<ReportDef> {
  const pours = await prisma.concretePour.findMany({
    include: {
      pile: true,
      structureElement: { include: { structure: true } },
      segment: true,
      pumpResource: true,
      crewResource: true,
    },
    orderBy: { plannedDate: "desc" },
    take: 1000,
  });
  return {
    key: "beton",
    title: "Beton Döküm Raporu",
    headers: [
      "Kod",
      "Hedef",
      "Planlanan Tarih",
      "Saat",
      "Beton Sınıfı",
      "Planlanan (m³)",
      "Gerçekleşen (m³)",
      "Fark (m³)",
      "Pompa",
      "Ekip",
      "Durum",
    ],
    rows: pours.map((p) => [
      p.code,
      pourTargetLabel(p),
      fmtDate(p.plannedDate),
      p.plannedTime ?? "—",
      p.concreteClass ?? UNSPECIFIED,
      fmtNum(p.plannedVolumeM3),
      fmtNum(p.actualVolumeM3),
      p.actualVolumeM3 !== null
        ? Number((Number(p.actualVolumeM3) - Number(p.plannedVolumeM3)).toFixed(1))
        : "—",
      p.pumpResource?.code ?? UNSPECIFIED,
      p.crewResource?.name ?? UNSPECIFIED,
      label(POUR_STATUS_LABELS, p.status),
    ]),
  };
}

export async function kazikRaporu(): Promise<ReportDef> {
  const piles = await prisma.pile.findMany({
    include: { pileGroup: { include: { element: { include: { structure: true } } } } },
    orderBy: { code: "asc" },
    take: 5000,
  });
  return {
    key: "kazik",
    title: "Kazık İlerleme Raporu",
    headers: [
      "Kazık",
      "Yapı",
      "Grup",
      "Çap (mm)",
      "Tasarım Boyu (m)",
      "Gerçek Boy (m)",
      "Beton Sınıfı",
      "Planlanan Beton (m³)",
      "Gerçek Beton (m³)",
      "Durum",
      "Test",
      "Kabul",
      "Problem",
    ],
    rows: piles.map((p) => [
      p.code,
      p.pileGroup.element.structure.code,
      p.pileGroup.name,
      p.diameterMm ?? "—",
      fmtNum(p.designLengthM),
      fmtNum(p.actualLengthM),
      p.concreteClass ?? UNSPECIFIED,
      fmtNum(p.plannedConcreteVolumeM3),
      fmtNum(p.actualConcreteVolumeM3),
      label(PILE_STATUS_LABELS, p.status),
      label(PILE_TEST_STATUS_LABELS, p.testStatus),
      label(PILE_ACCEPTANCE_LABELS, p.acceptanceStatus),
      p.problemDescription ?? "—",
    ]),
  };
}

export async function gunlukUretimRaporu(): Promise<ReportDef> {
  const { start, end } = dayRange(0);
  const [pours, activities] = await Promise.all([
    prisma.concretePour.findMany({
      where: { plannedDate: { gte: start, lt: end }, status: { not: "IPTAL" } },
      include: {
        pile: true,
        structureElement: { include: { structure: true } },
        segment: true,
      },
      orderBy: { plannedTime: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        OR: [
          { actualStart: { gte: start, lt: end } },
          { actualEnd: { gte: start, lt: end } },
          {
            status: "DEVAM_EDIYOR",
            plannedStart: { lt: end },
          },
        ],
      },
      include: { element: { include: { structure: true } } },
      orderBy: { plannedStart: "asc" },
    }),
  ]);
  return {
    key: "gunluk",
    title: `Günlük Üretim Raporu — ${new Date().toLocaleDateString("tr-TR")}`,
    headers: ["Tür", "Yapı", "İş", "Detay", "Durum"],
    rows: [
      ...pours.map((p) => [
        "Beton",
        p.structureElement?.structure.code ?? p.pile?.code.split("-")[0] ?? "—",
        pourTargetLabel(p),
        `${p.plannedTime ?? ""} ${fmtNum(p.plannedVolumeM3)} m³ ${p.concreteClass ?? UNSPECIFIED}`,
        label(POUR_STATUS_LABELS, p.status),
      ]),
      ...activities.map((a) => [
        "İmalat",
        a.element.structure.code,
        `${a.element.name} — ${a.name}`,
        `${fmtDate(a.plannedStart)} → ${fmtDate(a.plannedEnd)}`,
        label(ELEMENT_STATUS_LABELS, a.status),
      ]),
    ],
  };
}

export async function gecikmeRaporu(): Promise<ReportDef> {
  const now = new Date();
  const activities = await prisma.activity.findMany({
    where: { status: { notIn: ["TAMAMLANDI", "IPTAL"] }, plannedEnd: { lt: now } },
    include: { element: { include: { structure: true } } },
    orderBy: { plannedEnd: "asc" },
    take: 1000,
  });
  return {
    key: "gecikme",
    title: "Gecikme Raporu",
    headers: ["Yapı", "Eleman", "İş", "Planlanan Bitiş", "Gecikme (gün)", "Durum"],
    rows: activities.map((a) => [
      a.element.structure.code,
      a.element.name,
      a.name,
      fmtDate(a.plannedEnd),
      Math.ceil((now.getTime() - a.plannedEnd!.getTime()) / 86400e3),
      label(ELEMENT_STATUS_LABELS, a.status),
    ]),
  };
}

export async function acikRfiRaporu(): Promise<ReportDef> {
  const rfis = await prisma.rFI.findMany({
    where: { status: { notIn: ["CEVAPLANDI", "KAPATILDI"] } },
    include: {
      structure: true,
      element: true,
      affectedActivities: { include: { activity: true } },
    },
    orderBy: { date: "asc" },
  });
  return {
    key: "rfi",
    title: "Açık RFI Raporu",
    headers: ["RFI No", "Yapı", "Eleman", "Konu", "Tarih", "Gönderim", "Durum", "Bloke Ettiği İş"],
    rows: rfis.map((r) => [
      r.rfiNumber,
      r.structure.code,
      r.element?.name ?? "—",
      r.subject,
      fmtDate(r.date),
      fmtDate(r.submittedDate),
      label(RFI_STATUS_LABELS, r.status),
      r.affectedActivities.map((a) => a.activity.name).join(", ") || "—",
    ]),
  };
}

export async function ncrRaporu(): Promise<ReportDef> {
  const ncrs = await prisma.nCR.findMany({
    include: { structure: true, element: true },
    orderBy: { date: "desc" },
  });
  return {
    key: "ncr",
    title: "NCR Raporu",
    headers: ["NCR No", "Yapı", "Eleman", "Problem", "Tarih", "Son Tarih", "Durum", "Kapanış"],
    rows: ncrs.map((n) => [
      n.ncrNumber,
      n.structure.code,
      n.element?.name ?? "—",
      n.problemDescription,
      fmtDate(n.date),
      fmtDate(n.dueDate),
      label(NCR_STATUS_LABELS, n.status),
      fmtDate(n.closedDate),
    ]),
  };
}

export async function yediGunPlanRaporu(): Promise<ReportDef> {
  const { start, end } = dayRange(0, 7);
  const [pours, activities] = await Promise.all([
    prisma.concretePour.findMany({
      where: { plannedDate: { gte: start, lt: end }, status: { not: "IPTAL" } },
      include: {
        pile: true,
        structureElement: { include: { structure: true } },
        segment: true,
        pumpResource: true,
      },
      orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
    }),
    prisma.activity.findMany({
      where: {
        status: { notIn: ["TAMAMLANDI", "IPTAL"] },
        plannedStart: { gte: start, lt: end },
      },
      include: { element: { include: { structure: true } } },
      orderBy: { plannedStart: "asc" },
    }),
  ]);
  return {
    key: "7gun",
    title: "7 Günlük İleriye Dönük Plan",
    headers: ["Tarih", "Tür", "Yapı", "İş", "Detay"],
    rows: [
      ...pours.map((p) => [
        fmtDate(p.plannedDate),
        "Beton",
        p.structureElement?.structure.code ?? "—",
        pourTargetLabel(p),
        `${p.plannedTime ?? ""} ${fmtNum(p.plannedVolumeM3)} m³ · Pompa: ${p.pumpResource?.code ?? UNSPECIFIED}`,
      ]),
      ...activities.map((a) => [
        fmtDate(a.plannedStart),
        "İmalat",
        a.element.structure.code,
        `${a.element.name} — ${a.name}`,
        `${fmtDate(a.plannedStart)} → ${fmtDate(a.plannedEnd)}`,
      ]),
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  };
}

export const REPORTS: Record<string, { title: string; run: () => Promise<ReportDef> }> = {
  gunluk: { title: "Günlük Üretim Raporu", run: gunlukUretimRaporu },
  beton: { title: "Beton Döküm Raporu", run: betonRaporu },
  kazik: { title: "Kazık İlerleme Raporu", run: kazikRaporu },
  gecikme: { title: "Gecikme Raporu", run: gecikmeRaporu },
  rfi: { title: "Açık RFI Raporu", run: acikRfiRaporu },
  ncr: { title: "NCR Raporu", run: ncrRaporu },
  "7gun": { title: "7 Günlük Plan", run: yediGunPlanRaporu },
};
