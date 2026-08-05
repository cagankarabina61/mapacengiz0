// Seed: roller/izinler, hazırlık kapısı kataloğu, aktivite/ITP şablonları,
// demo kullanıcılar ve ÖRNEK VERİ (madde 68 — açıkça isSample=true işaretli).
import { PrismaClient, RoleName, PourTargetType, ElementType, CheckpointType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Kullanıcılar (demo) ──────────────────────────────
  const users: { name: string; email: string; role: RoleName }[] = [
    { name: "Yönetici", email: "yonetici@santiye.local", role: "YONETICI" },
    { name: "Teknik Ofis", email: "teknikofis@santiye.local", role: "TEKNIK_OFIS" },
    { name: "Saha Mühendisi", email: "saha@santiye.local", role: "SAHA_MUHENDISI" },
    { name: "QA/QC", email: "qaqc@santiye.local", role: "QAQC" },
    { name: "Survey", email: "survey@santiye.local", role: "SURVEY" },
    { name: "İzleyici", email: "izleyici@santiye.local", role: "IZLEYICI" },
  ];
  const passwordHash = await bcrypt.hash("santiye123", 10);
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  // ── Rol izinleri (madde 39-40) ───────────────────────
  // resource anahtarları servis katmanındaki assertPermission ile birebir.
  const perms: [RoleName, string, string[]][] = [
    ["TEKNIK_OFIS", "structure", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "element", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "segment", ["create", "update"]],
    ["SAHA_MUHENDISI", "structure", ["create", "update"]],
    ["TEKNIK_OFIS", "activity", ["create", "update"]],
    ["TEKNIK_OFIS", "drawing", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "rfi", ["create", "update", "delete"]],
    ["TEKNIK_OFIS", "itpTemplate", ["create", "update"]],
    ["TEKNIK_OFIS", "concretePour", ["create", "update"]],
    ["TEKNIK_OFIS", "pourOverride", ["create"]],
    ["TEKNIK_OFIS", "attachment", ["create"]],
    ["QAQC", "attachment", ["create"]],
    ["SURVEY", "attachment", ["create"]],
    ["SAHA_MUHENDISI", "element", ["create", "update"]],
    ["SAHA_MUHENDISI", "activity", ["update"]],
    ["SAHA_MUHENDISI", "pile", ["create", "update"]],
    ["SAHA_MUHENDISI", "segment", ["create", "update"]],
    ["SAHA_MUHENDISI", "concretePour", ["create", "update"]],
    ["SAHA_MUHENDISI", "checklist", ["update"]],
    ["SAHA_MUHENDISI", "issue", ["create", "update"]],
    ["SAHA_MUHENDISI", "attachment", ["create"]],
    ["SAHA_MUHENDISI", "resourceBooking", ["create", "update"]],
    ["QAQC", "inspection", ["create", "update"]],
    ["QAQC", "ncr", ["create", "update"]],
    ["QAQC", "pourQaqc", ["update"]],
    ["QAQC", "pileTest", ["update"]],
    ["SURVEY", "pourSurvey", ["update"]],
    ["SURVEY", "surveyRecord", ["create", "update"]],
  ];
  for (const [role, resource, actions] of perms) {
    for (const action of actions) {
      await prisma.rolePermission.upsert({
        where: { role_resource_action: { role, resource, action } },
        update: {},
        create: { role, resource, action },
      });
    }
  }

  // ── Beton hazırlık kapısı kataloğu (madde 11) ────────
  const ALL: PourTargetType[] = ["PILE", "STRUCTURE_ELEMENT", "SEGMENT"];
  const NO_PILE: PourTargetType[] = ["STRUCTURE_ELEMENT", "SEGMENT"];
  const checklist: [string, string, PourTargetType[]][] = [
    ["IFC_DRAWING", "Onaylı IFC çizimi mevcut", ALL],
    ["SHOP_DRAWING", "Onaylı shop drawing mevcut", ALL],
    ["REBAR_DONE", "Donatı tamamlandı", ALL],
    ["REBAR_CHECKED", "Donatı kontrol edildi", ALL],
    ["COVER_CHECKED", "Beton örtüsü kontrol edildi", ALL],
    ["FORMWORK_DONE", "Kalıp tamamlandı", NO_PILE],
    ["FORMWORK_CHECKED", "Kalıp ölçüleri kontrol edildi", NO_PILE],
    ["EMBEDDED_CHECKED", "Gömülü elemanlar kontrol edildi", NO_PILE],
    ["SURVEY_DONE", "Survey tamamlandı", ALL],
    ["QAQC_DONE", "QA/QC kontrolü tamamlandı", ALL],
    ["ITP_RELEASED", "ITP kontrol noktası serbest", ALL],
    ["MIX_APPROVED", "Beton reçetesi uygun", ALL],
    ["PUMP_PLANNED", "Beton pompası planlandı", ALL],
    ["CREW_READY", "Ekip hazır", ALL],
    ["VOLUME_CALCULATED", "Beton miktarı hesaplandı", ALL],
    ["ORDER_PLANNED", "Beton siparişi planlandı", ALL],
  ];
  let order = 1;
  for (const [itemKey, label, appliesTo] of checklist) {
    await prisma.checklistTemplateItem.upsert({
      where: { itemKey },
      update: { label, appliesTo, sequenceOrder: order },
      create: { itemKey, label, appliesTo, sequenceOrder: order },
    });
    order++;
  }

  // ── Aktivite şablonları (madde 35) ───────────────────
  // 3. eleman: requiresPileAcceptance — kazık kabulünü ön koşul yapan adım (madde 9).
  // "Tüm kazıklar kabul edildi" tek başına pier'i hazır YAPMAZ; yalnızca kazı adımını serbest bırakır.
  const templates: [ElementType, string, [string, string, boolean?][]][] = [
    ["PILE_CAP", "Pile Cap Standart İş Akışı", [
      ["EXCAVATION", "Kazı", true], // kazık kabulü olmadan pile cap kazısı başlamaz
      ["BLINDING", "Grobeton"],
      ["REBAR", "Donatı"],
      ["FORMWORK", "Kalıp"],
      ["EMBEDDED", "Gömülü Elemanlar"],
      ["SURVEY", "Survey"],
      ["CONCRETE", "Beton"],
      ["CURING", "Kür"],
    ]],
    ["PIER_GOVDESI", "Pier Gövdesi Standart İş Akışı", [
      ["REBAR", "Donatı"],
      ["FORMWORK", "Kalıp"],
      ["EMBEDDED", "Gömülü Elemanlar"],
      ["SURVEY", "Survey"],
      ["CONCRETE", "Beton"],
      ["CURING", "Kür"],
    ]],
    ["BASLIK", "Başlık Standart İş Akışı", [
      ["REBAR", "Donatı"],
      ["FORMWORK", "Kalıp"],
      ["SURVEY", "Survey"],
      ["CONCRETE", "Beton"],
      ["CURING", "Kür"],
    ]],
  ];
  for (const [elementType, name, steps] of templates) {
    const tpl = await prisma.activityTemplate.upsert({
      where: { elementType },
      update: { name },
      create: { elementType, name },
    });
    let seq = 1;
    for (const [activityType, stepName, requiresPiles] of steps) {
      await prisma.activityTemplateStep.upsert({
        where: { templateId_sequenceOrder: { templateId: tpl.id, sequenceOrder: seq } },
        update: { activityType, name: stepName, requiresPileAcceptance: !!requiresPiles },
        create: {
          templateId: tpl.id,
          activityType,
          name: stepName,
          sequenceOrder: seq,
          requiresPileAcceptance: !!requiresPiles,
        },
      });
      seq++;
    }
  }

  // ── ITP şablonu — Pile Cap (madde 24) ────────────────
  const itpTpl = await prisma.iTPTemplate.upsert({
    where: { elementType: "PILE_CAP" },
    update: {},
    create: { elementType: "PILE_CAP", name: "Pile Cap ITP" },
  });
  const itpPoints: [string, CheckpointType][] = [
    ["Kazı Kontrolü", "INSPECTION"],
    ["Grobeton Kontrolü", "INSPECTION"],
    ["Donatı Kontrolü", "HOLD_POINT"],
    ["Kalıp Kontrolü", "WITNESS_POINT"],
    ["Gömülü Eleman Kontrolü", "INSPECTION"],
    ["Survey Kontrolü", "HOLD_POINT"],
    ["Beton Dökümü", "HOLD_POINT"],
    ["Kür Kontrolü", "REVIEW"],
  ];
  let iseq = 1;
  for (const [name, checkpointType] of itpPoints) {
    await prisma.iTPCheckpoint.upsert({
      where: { templateId_sequenceOrder: { templateId: itpTpl.id, sequenceOrder: iseq } },
      update: { name, checkpointType },
      create: { templateId: itpTpl.id, name, checkpointType, sequenceOrder: iseq },
    });
    iseq++;
  }

  // ── Kaynaklar ────────────────────────────────────────
  // capacityM3PerHour: pompa süresi hesabı için (madde 10)
  // isPhysicallyExclusive: aynı anda tek yerde olabilen kaynak → kritik çakışma (madde 4)
  const resources: [string, string, string, number | null, boolean][] = [
    ["POMPA", "P-01", "Beton Pompası P-01", 60, true],
    ["POMPA", "P-02", "Beton Pompası P-02", 45, true],
    ["BETON_EKIBI", "BE-A", "Beton Ekibi A", null, true],
    ["BETON_EKIBI", "BE-B", "Beton Ekibi B", null, true],
    ["DONATI_EKIBI", "DE-A", "Donatı Ekibi A", null, true],
    ["KALIP_EKIBI", "KE-A", "Kalıp Ekibi A", null, true],
    ["SURVEY_EKIBI", "SE-A", "Survey Ekibi A", null, false], // bölünebilir: iki noktada ölçüm yapabilir
    ["QAQC_EKIBI", "QE-A", "QA/QC Ekibi A", null, false],
    ["VINC", "V-01", "Kule Vinç V-01", null, true],
  ];
  for (const [type, code, name, capacity, exclusive] of resources) {
    await prisma.resource.upsert({
      where: { code },
      update: { capacityM3PerHour: capacity, isPhysicallyExclusive: exclusive },
      create: {
        type: type as never,
        code,
        name,
        capacityM3PerHour: capacity,
        isPhysicallyExclusive: exclusive,
      },
    });
  }

  // ── Dengeli konsol kapı kuralı (madde 5) ─────────────
  // ÖRNEK VERİ: gerçek kural projenin onaylı Method Statement'ından girilmelidir.
  // Sistem bu kaydı bulamazsa kapı kararı ÜRETMEZ ("Tanımlanmamış" der).
  const existingRule = await prisma.segmentGateRule.findFirst({ where: { structureId: null } });
  if (!existingRule) {
    await prisma.segmentGateRule.create({
      data: {
        structureId: null,
        requiredSteps: [
          "rebarStatus",
          "formworkStatus",
          "tendonStatus",
          "anchorageStatus",
          "embeddedItemsStatus",
          "inspectionStatus",
          "concreteStatus",
          "postTensioningStatus",
          "surveyStatus",
        ],
        requireStrength: true,
        asymmetryThreshold: 2,
        note: "ÖRNEK VERİ — proje Method Statement'ı ile doğrulanmalıdır",
      },
    });
  }

  // ── ÖRNEK VERİ: proje + VIA-11 (madde 68) ────────────
  const project = await prisma.project.upsert({
    where: { code: "SP-DEMO" },
    update: {},
    create: {
      code: "SP-DEMO",
      name: "Sibiu–Pitești Otoyolu (ÖRNEK VERİ)",
      country: "Romanya",
      client: "ÖRNEK VERİ",
      isSample: true,
    },
  });

  const via11 = await prisma.structure.upsert({
    where: { code: "VIA-11" },
    // Gerçek projede VIA-11'de dengeli konsol yok (kullanıcı teyidi) — bayrak kapalı.
    // Örnek segment verileri kayıtta kalabilir ama sekme bu bayrakla gizlenir (§44).
    update: { hasBalancedCantilever: false },
    create: {
      projectId: project.id,
      code: "VIA-11",
      name: "Viyadük 11 (ÖRNEK VERİ)",
      type: "VIYADUK",
      isSample: true,
      hasBalancedCantilever: false,
    },
  });

  // Pierler P1..P6 + A1/A2
  const elementCodes = [
    ["VIA11-A1", "A1", "ABUTMENT"],
    ["VIA11-P01", "P1", "PIER"],
    ["VIA11-P02", "P2", "PIER"],
    ["VIA11-P03", "P3", "PIER"],
    ["VIA11-P04", "P4", "PIER"],
    ["VIA11-P05", "P5", "PIER"],
    ["VIA11-P06", "P6", "PIER"],
    ["VIA11-A2", "A2", "ABUTMENT"],
  ] as const;
  let seqIdx = 0;
  for (const [code, name, elementType] of elementCodes) {
    await prisma.structureElement.upsert({
      where: { code },
      update: {},
      create: {
        structureId: via11.id,
        code,
        name,
        elementType,
        sequenceIndex: seqIdx++,
        status: "PLANLANDI",
      },
    });
  }

  // P5 altı: Pile Cap + Pier Gövdesi + kazık grubu + 8 kazık
  const p5 = await prisma.structureElement.findUniqueOrThrow({ where: { code: "VIA11-P05" } });
  const p5pc = await prisma.structureElement.upsert({
    where: { code: "VIA11-P05-PC" },
    update: {},
    create: {
      structureId: via11.id,
      parentId: p5.id,
      code: "VIA11-P05-PC",
      name: "P5 Pile Cap",
      elementType: "PILE_CAP",
      status: "DEVAM_EDIYOR",
    },
  });
  await prisma.structureElement.upsert({
    where: { code: "VIA11-P05-PIER" },
    update: {},
    create: {
      structureId: via11.id,
      parentId: p5.id,
      code: "VIA11-P05-PIER",
      name: "P5 Pier Gövdesi",
      elementType: "PIER_GOVDESI",
      status: "PLANLANDI",
    },
  });

  const group = await prisma.pileGroup.findFirst({ where: { elementId: p5.id } })
    ?? await prisma.pileGroup.create({
      data: { elementId: p5.id, name: "P5 Kazık Grubu", designPileCount: 8 },
    });

  for (let i = 1; i <= 8; i++) {
    const code = `VIA11-P05-PILE-${String(i).padStart(2, "0")}`;
    const done = i <= 6;
    await prisma.pile.upsert({
      where: { code },
      update: {},
      create: {
        pileGroupId: group.id,
        code,
        diameterMm: 1500,
        designLengthM: 25,
        status: done ? (i <= 4 ? "KABUL_EDILDI" : "TEST_BEKLIYOR") : "DELGI_DEVAM_EDIYOR",
        testStatus: i <= 4 ? "YAPILDI" : "BEKLIYOR",
        acceptanceStatus: i <= 4 ? "KABUL" : "BEKLIYOR",
        concreteClass: "C30/37",
        plannedConcreteVolumeM3: 44.2,
        ...(done ? { actualConcreteVolumeM3: 45.1, concreteDate: new Date("2026-07-20") } : {}),
      },
    });
  }

  // ── ÖRNEK: P5 Pier segmentleri (dengeli konsol) ──────
  const p5pier = await prisma.structureElement.findUniqueOrThrow({
    where: { code: "VIA11-P05-PIER" },
  });
  const done = {
    rebarStatus: "TAMAMLANDI",
    formworkStatus: "TAMAMLANDI",
    tendonStatus: "TAMAMLANDI",
    anchorageStatus: "TAMAMLANDI",
    embeddedItemsStatus: "TAMAMLANDI",
    inspectionStatus: "TAMAMLANDI",
    concreteStatus: "TAMAMLANDI",
    postTensioningStatus: "TAMAMLANDI",
    surveyStatus: "TAMAMLANDI",
    groutingStatus: "TAMAMLANDI",
    status: "TAMAMLANDI",
  } as const;
  for (const side of ["SOL", "SAG"] as const) {
    const completedUpTo = side === "SOL" ? 2 : 1;
    for (let n = 0; n <= 3; n++) {
      const code = `VIA11-P05-SEG-${side === "SOL" ? "L" : "R"}${n}`;
      await prisma.balancedCantileverSegment.upsert({
        where: { code },
        update: {},
        create: {
          pierElementId: p5pier.id,
          code,
          segmentNumber: n,
          side,
          requiredConcreteStrengthMPa: 35,
          ...(n <= completedUpTo
            ? { ...done, achievedConcreteStrengthMPa: 38 }
            : {}),
        },
      });
    }
  }

  // ── ÖRNEK: P5 Pile Cap aktiviteleri (şablondan) + P6 RFI blokajı ──
  const pcTemplate = await prisma.activityTemplate.findUnique({
    where: { elementType: "PILE_CAP" },
    include: { steps: { orderBy: { sequenceOrder: "asc" } } },
  });
  if (pcTemplate) {
    const existing = await prisma.activity.findFirst({ where: { elementId: p5pc.id } });
    if (!existing) {
      // Ekip bazlı plan örneği (madde 2): sorumlu mühendis / ekip / QA-QC / Survey / ekipman
      const [sahaUser, qaqcUser, surveyUser] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { email: "saha@santiye.local" } }),
        prisma.user.findUniqueOrThrow({ where: { email: "qaqc@santiye.local" } }),
        prisma.user.findUniqueOrThrow({ where: { email: "survey@santiye.local" } }),
      ]);
      const crewFor = async (activityType: string) => {
        const code =
          activityType === "REBAR"
            ? "DE-A"
            : activityType === "FORMWORK"
              ? "KE-A"
              : activityType === "SURVEY"
                ? "SE-A"
                : activityType === "CONCRETE"
                  ? "BE-A"
                  : null;
        return code ? await prisma.resource.findUnique({ where: { code } }) : null;
      };
      const crane = await prisma.resource.findUnique({ where: { code: "V-01" } });

      let prevId: string | null = null;
      for (const step of pcTemplate.steps) {
        const done = step.sequenceOrder <= 3; // Kazı/Grobeton/Donatı tamam
        const crew = await crewFor(step.activityType);
        const act = await prisma.activity.create({
          data: {
            elementId: p5pc.id,
            activityType: step.activityType,
            name: step.name,
            sequenceIndex: step.sequenceOrder,
            status: done ? "TAMAMLANDI" : step.sequenceOrder === 4 ? "DEVAM_EDIYOR" : "PLANLANDI",
            plannedStart: new Date(Date.now() + (step.sequenceOrder - 4) * 86400e3),
            plannedEnd: new Date(Date.now() + (step.sequenceOrder - 3) * 86400e3),
            responsibleUserId: sahaUser.id,
            qaqcUserId: qaqcUser.id,
            surveyUserId: step.activityType === "SURVEY" ? surveyUser.id : null,
            crewResourceId: crew?.id ?? null,
            equipmentResourceId: step.activityType === "REBAR" ? (crane?.id ?? null) : null,
          },
        });
        if (prevId) {
          await prisma.dependency.upsert({
            where: {
              predecessorActivityId_successorActivityId: {
                predecessorActivityId: prevId,
                successorActivityId: act.id,
              },
            },
            update: {},
            create: { predecessorActivityId: prevId, successorActivityId: act.id },
          });
        }
        prevId = act.id;
      }
    }
  }

  // P6 pier donatısı — açık RFI'ye bağlı (madde 23 örneği)
  const p6 = await prisma.structureElement.findUniqueOrThrow({ where: { code: "VIA11-P06" } });
  let p6Rebar = await prisma.activity.findFirst({
    where: { elementId: p6.id, activityType: "REBAR" },
  });
  if (!p6Rebar) {
    p6Rebar = await prisma.activity.create({
      data: {
        elementId: p6.id,
        activityType: "REBAR",
        name: "P6 Pier Donatısı",
        status: "PLANLANDI",
        plannedStart: new Date(Date.now() - 2 * 86400e3),
        plannedEnd: new Date(Date.now() - 1 * 86400e3), // geçmiş → Gecikmiş örneği
      },
    });
    const rfi = await prisma.rFI.upsert({
      where: { rfiNumber: "RFI-024" },
      update: {},
      create: {
        rfiNumber: "RFI-024",
        date: new Date(),
        structureId: via11.id,
        elementId: p6.id,
        subject: "P6 donatı bindirme boyu revizyonu",
        priority: "YUKSEK",
        status: "CEVAP_BEKLENIYOR",
        submittedDate: new Date(Date.now() - 5 * 86400e3),
      },
    });
    await prisma.rFIAffectedActivity.upsert({
      where: { rfiId_activityId: { rfiId: rfi.id, activityId: p6Rebar.id } },
      update: {},
      create: { rfiId: rfi.id, activityId: p6Rebar.id },
    });
  }

  // ── ÖRNEK: beton dökümleri (yarın, biri hazır değil + pompa çakışması) ──
  const pump1 = await prisma.resource.findUniqueOrThrow({ where: { code: "P-01" } });
  const crewA = await prisma.resource.findUniqueOrThrow({ where: { code: "BE-A" } });
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const pourCount = await prisma.concretePour.count();
  if (pourCount === 0) {
    const templateItems = await prisma.checklistTemplateItem.findMany({
      orderBy: { sequenceOrder: "asc" },
    });
    // Döküm 1: P5 Pile Cap — çoğu madde işaretli ama QA/QC eksik → "Hazır Değil"
    const pour1 = await prisma.concretePour.create({
      data: {
        code: "POUR-2026-0001",
        targetType: "STRUCTURE_ELEMENT",
        structureElementId: p5pc.id,
        plannedDate: tomorrow,
        plannedTime: "07:00",
        concreteClass: "C30/37",
        plannedVolumeM3: 145,
        pumpResourceId: pump1.id,
        crewResourceId: crewA.id,
        status: "PLANLANDI",
        // 145 m³ ÷ (60 m³/sa × %70) = ~207 dk + 60 dk hazırlık/temizlik
        estimatedDurationMin: 267,
        responsibleUserId: (
          await prisma.user.findUniqueOrThrow({ where: { email: "saha@santiye.local" } })
        ).id,
      },
    });
    const applicable1 = templateItems.filter((t) => t.appliesTo.includes("STRUCTURE_ELEMENT"));
    await prisma.concretePourChecklistItem.createMany({
      data: applicable1.map((t) => ({
        pourId: pour1.id,
        itemKey: t.itemKey,
        label: t.label,
        isChecked: !["QAQC_DONE", "ITP_RELEASED", "SURVEY_DONE"].includes(t.itemKey),
      })),
    });

    // Döküm 2: Kazık 07 — aynı pompa, çakışan saat (madde 13 örneği)
    const pile7 = await prisma.pile.findUniqueOrThrow({ where: { code: "VIA11-P05-PILE-07" } });
    const pour2 = await prisma.concretePour.create({
      data: {
        code: "POUR-2026-0002",
        targetType: "PILE",
        pileId: pile7.id,
        plannedDate: tomorrow,
        plannedTime: "09:00",
        concreteClass: "C30/37",
        plannedVolumeM3: 44,
        pumpResourceId: pump1.id,
        crewResourceId: crewA.id,
        status: "PLANLANDI",
        qaqcStatus: "TAMAMLANDI",
        surveyStatus: "TAMAMLANDI",
        itpStatus: "TAMAMLANDI",
        // 44 m³ ÷ (60 × %70) = ~63 dk + 60 dk → 07:00 dökümüyle KRİTİK çakışma üretir
        estimatedDurationMin: 123,
      },
    });
    const applicable2 = templateItems.filter((t) => t.appliesTo.includes("PILE"));
    await prisma.concretePourChecklistItem.createMany({
      data: applicable2.map((t) => ({
        pourId: pour2.id,
        itemKey: t.itemKey,
        label: t.label,
        isChecked: true, // tümü tamam → "Hazır" ama pompa çakışması uyarısı var
      })),
    });
  }

  // ── GERÇEK YAPI KAYITLARI: VIA-1 … VIA-48 ────────────
  // Kullanıcı talebiyle: yapılar boş iskelet olarak oluşturulur, pier detayı
  // (hangi yapıda kaç pier olduğu vb.) sistemde UYDURULMAZ (madde 49) —
  // her yapı elemanı kullanıcı tarafından /yapilar/[kod] sayfasındaki
  // "Eleman Ekle" formuyla ihtiyaç oldukça manuel eklenir.
  // Proje bilgisi (isim/ülke/müşteri) onaylı PTE dokümanından teyitli gerçek veridir.
  const realProject = await prisma.project.upsert({
    where: { code: "SP-S2" },
    update: {},
    create: {
      code: "SP-S2",
      name: "Sibiu–Pitești Otoyolu, Bölüm 2: Boița–Cornetu",
      country: "Romanya",
      client: "CNAIR",
      isSample: false,
    },
  });

  for (let n = 1; n <= 48; n++) {
    const code = `VIA-${n}`;
    await prisma.structure.upsert({
      where: { code },
      update: {},
      create: {
        projectId: realProject.id,
        code,
        name: `Viyadük ${n}`,
        type: "VIYADUK",
        isSample: false,
      },
    });
  }

  console.log("Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
