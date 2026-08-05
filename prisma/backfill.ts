// Tek seferlik veri tamamlama: mevcut dökümlere süre/sorumlu ve kaynak rezervasyonu ekler.
// Yeni alanlar migration ile geldiği için önceden oluşturulmuş kayıtlarda boştular.
import { PrismaClient } from "@prisma/client";
import { estimatePourDuration, pourWindow } from "../src/lib/logic/pour-planning";

const prisma = new PrismaClient();

async function main() {
  const saha = await prisma.user.findUniqueOrThrow({ where: { email: "saha@santiye.local" } });
  const pours = await prisma.concretePour.findMany({ include: { bookings: true } });

  for (const pour of pours) {
    const pump = pour.pumpResourceId
      ? await prisma.resource.findUnique({ where: { id: pour.pumpResourceId } })
      : null;
    const duration = estimatePourDuration({
      plannedVolumeM3: Number(pour.plannedVolumeM3),
      pumpCapacityM3PerHour: pump?.capacityM3PerHour ? Number(pump.capacityM3PerHour) : null,
      overrideDurationMin: null,
    });
    const win = pourWindow(pour.plannedDate, pour.plannedTime, duration.durationMin);

    await prisma.concretePour.update({
      where: { id: pour.id },
      data: {
        estimatedDurationMin: duration.durationMin,
        plannedEndTime: win.end,
        responsibleUserId: pour.responsibleUserId ?? saha.id,
      },
    });

    if (pour.bookings.length === 0) {
      for (const resourceId of [pour.pumpResourceId, pour.crewResourceId]) {
        if (!resourceId) continue;
        await prisma.resourceBooking.create({
          data: {
            resourceId,
            targetType: "CONCRETE_POUR",
            pourId: pour.id,
            startDateTime: win.start,
            endDateTime: win.end,
          },
        });
      }
    }
    console.log(`${pour.code}: ${duration.durationMin ?? "süre yok"} dk`);
  }

  // Mevcut aktivitelere ekip/sorumlu ataması (yeni alanlar migration ile geldi)
  const [qaqc, survey] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "qaqc@santiye.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "survey@santiye.local" } }),
  ]);
  const crewByType: Record<string, string> = {
    REBAR: "DE-A",
    FORMWORK: "KE-A",
    SURVEY: "SE-A",
    CONCRETE: "BE-A",
    EXCAVATION: "KE-A",
    BLINDING: "BE-B",
  };
  const activities = await prisma.activity.findMany({ where: { responsibleUserId: null } });
  for (const a of activities) {
    const code = crewByType[a.activityType];
    const crew = code ? await prisma.resource.findUnique({ where: { code } }) : null;
    await prisma.activity.update({
      where: { id: a.id },
      data: {
        responsibleUserId: saha.id,
        qaqcUserId: qaqc.id,
        surveyUserId: a.activityType === "SURVEY" ? survey.id : null,
        crewResourceId: crew?.id ?? null,
      },
    });
  }
  console.log(`${activities.length} aktiviteye ekip/sorumlu atandı.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
