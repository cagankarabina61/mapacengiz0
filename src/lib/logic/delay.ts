// Gecikme hesabı (madde 31). Proje takvimi (tatil günleri) ileride eklenebilir
// diye karşılaştırma tek bir fonksiyonda toplandı.

export interface DelayInput {
  plannedEnd: Date | null;
  actualEnd: Date | null;
  isCompleted: boolean;
  today?: Date;
}

export interface DelayResult {
  isDelayed: boolean;
  delayDays: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeDelay(input: DelayInput): DelayResult {
  const today = input.today ?? new Date();
  if (!input.plannedEnd) return { isDelayed: false, delayDays: 0 };

  if (input.isCompleted) {
    if (input.actualEnd && input.actualEnd > input.plannedEnd) {
      return {
        isDelayed: false, // tamamlanmış iş artık "Gecikmiş" listesinde gösterilmez
        delayDays: Math.ceil((input.actualEnd.getTime() - input.plannedEnd.getTime()) / MS_PER_DAY),
      };
    }
    return { isDelayed: false, delayDays: 0 };
  }

  if (today > input.plannedEnd) {
    return {
      isDelayed: true,
      delayDays: Math.ceil((today.getTime() - input.plannedEnd.getTime()) / MS_PER_DAY),
    };
  }
  return { isDelayed: false, delayDays: 0 };
}
