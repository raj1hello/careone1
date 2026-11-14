export type DoseTimeSlot = 'Morning' | 'Afternoon' | 'Evening' | 'Bedtime';

export interface PrescribedMedicineItem {
  medicineName: string;
  dosage: string;
  frequencyLabel: string;
  timings: DoseTimeSlot[];
  durationDays: number;
  foodInstruction: string;
  precautions?: string;
}

export interface GeneratedDoseSlot {
  dayNumber: number;
  dateStr: string;
  timeSlot: DoseTimeSlot;
  medicineName: string;
  dosage: string;
  foodInstruction: string;
  precautions: string;
  status: 'pending' | 'taken' | 'skipped';
}

export interface GeneratedMedicineCoursePlan {
  startDate: string;
  totalDays: number;
  scheduleStatus: 'active' | 'incomplete_requires_doctor_clarification';
  incompleteReasons: string[];
  doses: GeneratedDoseSlot[];
}

export const ALL_DOSE_SLOTS: DoseTimeSlot[] = ['Morning', 'Afternoon', 'Evening', 'Bedtime'];

export const FREQUENCY_PRESETS: Array<{ label: string; timings: DoseTimeSlot[] }> = [
  { label: 'Once daily (Morning)', timings: ['Morning'] },
  { label: 'Once daily (Bedtime)', timings: ['Bedtime'] },
  { label: 'Twice daily (Morning & Evening)', timings: ['Morning', 'Evening'] },
  { label: 'Three times daily (Morning, Afternoon & Bedtime)', timings: ['Morning', 'Afternoon', 'Bedtime'] },
  { label: 'Four times daily', timings: ['Morning', 'Afternoon', 'Evening', 'Bedtime'] },
];

export const FOOD_INSTRUCTION_OPTIONS = [
  'After food',
  'Before food',
  'With meal',
  'Empty stomach',
  'As directed by doctor',
];

const SLOT_ORDER: Record<DoseTimeSlot, number> = {
  Morning: 1,
  Afternoon: 2,
  Evening: 3,
  Bedtime: 4,
};

function addDaysIso(baseDateStr: string, offsetDays: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Deterministically builds a day-by-day, timing-slot-by-timing-slot medicine course
 * strictly from explicit doctor-prescribed items. Never guesses missing dosage,
 * duration, or timing slots—instead flags incomplete entries clearly.
 */
export function generateDayWiseMedicineCourse(
  items: PrescribedMedicineItem[],
  startDate?: string
): GeneratedMedicineCoursePlan {
  const effectiveStart =
    startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? startDate
      : new Date().toISOString().slice(0, 10);

  const incompleteReasons: string[] = [];
  const doses: GeneratedDoseSlot[] = [];
  let maxDays = 0;

  if (!Array.isArray(items) || items.length === 0) {
    return {
      startDate: effectiveStart,
      totalDays: 0,
      scheduleStatus: 'incomplete_requires_doctor_clarification',
      incompleteReasons: ['Prescription contains no medicine items.'],
      doses: [],
    };
  }

  for (const item of items) {
    const name = (item.medicineName || '').trim();
    const dosage = (item.dosage || '').trim();
    const days = Number(item.durationDays);
    const validTimings = Array.isArray(item.timings)
      ? item.timings.filter((t): t is DoseTimeSlot => ALL_DOSE_SLOTS.includes(t))
      : [];

    if (!name) {
      incompleteReasons.push('A prescribed item is missing a medicine name.');
      continue;
    }
    if (!dosage) {
      incompleteReasons.push(`${name}: missing exact dosage (doctor clarification required).`);
      continue;
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      incompleteReasons.push(`${name}: missing valid duration in days (doctor clarification required).`);
      continue;
    }
    if (validTimings.length === 0) {
      incompleteReasons.push(`${name}: missing explicit timing slots (Morning/Afternoon/Evening/Bedtime).`);
      continue;
    }

    if (days > maxDays) maxDays = days;

    const uniqueSortedSlots = Array.from(new Set(validTimings)).sort(
      (a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]
    );

    for (let day = 1; day <= days; day += 1) {
      const dateStr = addDaysIso(effectiveStart, day - 1);
      for (const slot of uniqueSortedSlots) {
        doses.push({
          dayNumber: day,
          dateStr,
          timeSlot: slot,
          medicineName: name.slice(0, 160),
          dosage: dosage.slice(0, 80),
          foodInstruction: (item.foodInstruction || 'As directed by doctor').trim().slice(0, 120),
          precautions: (item.precautions || '').trim().slice(0, 300),
          status: 'pending',
        });
      }
    }
  }

  doses.sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
    const slotDiff = SLOT_ORDER[a.timeSlot] - SLOT_ORDER[b.timeSlot];
    if (slotDiff !== 0) return slotDiff;
    return a.medicineName.localeCompare(b.medicineName);
  });

  return {
    startDate: effectiveStart,
    totalDays: maxDays,
    scheduleStatus:
      incompleteReasons.length > 0 ? 'incomplete_requires_doctor_clarification' : 'active',
    incompleteReasons,
    doses,
  };
}

export interface DoseLike {
  id?: string;
  dayNumber: number;
  dateStr?: string;
  timeSlot: string;
  medicineName: string;
  dosage: string;
  foodInstruction?: string;
  precautions?: string;
  status: 'pending' | 'taken' | 'skipped';
}

export function summarizeCourseProgress(doses: DoseLike[]) {
  const total = doses.length;
  const taken = doses.filter((d) => d.status === 'taken').length;
  const skipped = doses.filter((d) => d.status === 'skipped').length;
  const pending = total - taken - skipped;
  const completedCount = taken + skipped;
  const progressPercent = total > 0 ? Math.round((taken / total) * 100) : 0;
  const allResolved = total > 0 && pending === 0;
  return {
    total,
    taken,
    skipped,
    pending,
    completedCount,
    progressPercent,
    allResolved,
  };
}

export function groupDosesByDay<T extends DoseLike>(doses: T[]) {
  const byDay = new Map<number, { dayNumber: number; dateStr: string; items: T[] }>();
  const sorted = [...doses].sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
    const sa = SLOT_ORDER[a.timeSlot as DoseTimeSlot] || 99;
    const sb = SLOT_ORDER[b.timeSlot as DoseTimeSlot] || 99;
    return sa - sb;
  });

  for (const dose of sorted) {
    if (!byDay.has(dose.dayNumber)) {
      byDay.set(dose.dayNumber, {
        dayNumber: dose.dayNumber,
        dateStr: dose.dateStr || '',
        items: [],
      });
    }
    byDay.get(dose.dayNumber)!.items.push(dose);
  }

  return Array.from(byDay.values());
}
