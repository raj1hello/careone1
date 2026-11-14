import type { ActivitySeriesPoint, BarDatum, RevenuePeriodPoint } from '../HospitalCharts.tsx';

export interface HospitalDashboardData {
  hospital: Record<string, any>;
  stats: {
    total: number;
    available: number;
    occupied: number;
    maintenance: number;
    reserved: number;
    icu_available: number;
    icu_total: number;
    total_patients: number;
    active_inpatients: number;
    opd_visits: number;
    pending_doctor_verifications: number;
    verified_doctors: number;
    today_appointments: number;
    today_admissions: number;
    today_discharges: number;
    active_emergencies: number;
    revenue_total: number;
    insurance_covered: number;
    collected_revenue: number;
    pending_payments_total: number;
    today_collected_revenue: number;
  };
  beds: any[];
  admissions: any[];
  doctors: any[];
  staff: any[];
  appointments: any[];
  emergencies: any[];
  patients: any[];
  resources: any[];
  payments: any[];
}

export function buildActivitySeries(
  data: HospitalDashboardData,
  days: 7 | 30 | 90
): ActivitySeriesPoint[] {
  const points: ActivitySeriesPoint[] = [];
  const today = new Date();

  const apptMap = new Map<string, number>();
  const admMap = new Map<string, number>();
  const disMap = new Map<string, number>();

  for (const a of data.appointments || []) {
    const key = String(a.appointment_date || '').slice(0, 10);
    if (key) apptMap.set(key, (apptMap.get(key) || 0) + 1);
  }
  for (const adm of data.admissions || []) {
    const admDay = String(adm.admitted_at || '').slice(0, 10);
    if (admDay) {
      if (adm.admission_type === 'opd') {
        apptMap.set(admDay, (apptMap.get(admDay) || 0) + 1);
      } else {
        admMap.set(admDay, (admMap.get(admDay) || 0) + 1);
      }
    }
    if (adm.discharged_at) {
      const disDay = String(adm.discharged_at).slice(0, 10);
      disMap.set(disDay, (disMap.get(disDay) || 0) + 1);
    }
  }

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    points.push({
      label,
      fullDate: iso,
      visits: apptMap.get(iso) || 0,
      admissions: admMap.get(iso) || 0,
      discharges: disMap.get(iso) || 0,
    });
  }

  return points;
}

export interface WardOccupancyRow {
  bedType: 'general' | 'private' | 'icu' | 'emergency';
  label: string;
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  maintenance: number;
  occupancyPct: number;
}

export function buildWardStats(beds: any[]): WardOccupancyRow[] {
  const defs: Array<{ bedType: 'general' | 'private' | 'icu' | 'emergency'; label: string }> = [
    { bedType: 'general', label: 'General Ward' },
    { bedType: 'private', label: 'Private Rooms' },
    { bedType: 'icu', label: 'ICU' },
    { bedType: 'emergency', label: 'Emergency' },
  ];

  return defs.map((def) => {
    const list = (beds || []).filter((b) => b.bed_type === def.bedType);
    const occupied = list.filter((b) => b.status === 'occupied').length;
    const available = list.filter((b) => b.status === 'available').length;
    const reserved = list.filter((b) => b.status === 'reserved').length;
    const maintenance = list.filter((b) => b.status === 'maintenance').length;
    const occupancyPct = list.length > 0 ? Math.round((occupied / list.length) * 100) : 0;
    return {
      ...def,
      total: list.length,
      occupied,
      available,
      reserved,
      maintenance,
      occupancyPct,
    };
  });
}

export function buildDepartmentPerformance(data: HospitalDashboardData): BarDatum[] {
  let declaredDepts: string[] = [];
  try {
    declaredDepts = JSON.parse(data.hospital?.departments_json || '[]');
  } catch {
    declaredDepts = [];
  }

  const counts = new Map<string, number>();
  for (const dept of declaredDepts) {
    if (dept && typeof dept === 'string') counts.set(dept, 0);
  }
  for (const doc of data.doctors || []) {
    if (doc.specialization && !counts.has(doc.specialization)) {
      counts.set(doc.specialization, 0);
    }
  }

  for (const appt of data.appointments || []) {
    const dept = appt.specialization;
    if (dept) counts.set(dept, (counts.get(dept) || 0) + 1);
  }
  for (const adm of data.admissions || []) {
    const dept = adm.department;
    if (dept && counts.has(dept)) {
      counts.set(dept, (counts.get(dept) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([label, value], idx) => ({
      label,
      value,
      sublabel: value === 0 ? 'No visits recorded yet' : `${value} clinical encounter${value === 1 ? '' : 's'}`,
      color: idx % 2 === 0 ? '#5350cc' : '#00b1ff',
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildRevenueSeries(
  data: HospitalDashboardData,
  granularity: 'weekly' | 'monthly'
): RevenuePeriodPoint[] {
  const buckets = new Map<string, { label: string; billed: number; collected: number }>();

  const now = new Date();
  if (granularity === 'weekly') {
    for (let w = 3; w >= 0; w -= 1) {
      const start = new Date(now);
      start.setDate(now.getDate() - w * 7 - 6);
      const end = new Date(now);
      end.setDate(now.getDate() - w * 7);
      const key = `W${4 - w}`;
      const label = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.getDate()}`;
      buckets.set(key, { label, billed: 0, collected: 0 });
    }

    const assignWeek = (iso: string): string | null => {
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return null;
      const diffDays = Math.floor((now.getTime() - dt.getTime()) / 86400000);
      if (diffDays < 0 || diffDays >= 28) return null;
      const weekIdx = 3 - Math.floor(diffDays / 7);
      return `W${weekIdx + 1}`;
    };

    for (const adm of data.admissions || []) {
      const k = assignWeek(adm.discharged_at || adm.admitted_at);
      if (k && buckets.has(k)) {
        buckets.get(k)!.billed += Number(adm.total_billed_amount || 0);
      }
    }
    for (const pay of data.payments || []) {
      if (pay.status === 'paid') {
        const k = assignWeek(pay.created_at);
        if (k && buckets.has(k)) {
          buckets.get(k)!.collected += Number(pay.amount || 0);
        }
      }
    }
  } else {
    for (let m = 5; m >= 0; m -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { month: 'short' });
      buckets.set(key, { label, billed: 0, collected: 0 });
    }

    for (const adm of data.admissions || []) {
      const key = String(adm.discharged_at || adm.admitted_at || '').slice(0, 7);
      if (buckets.has(key)) {
        buckets.get(key)!.billed += Number(adm.total_billed_amount || 0);
      }
    }
    for (const pay of data.payments || []) {
      if (pay.status === 'paid') {
        const key = String(pay.created_at || '').slice(0, 7);
        if (buckets.has(key)) {
          buckets.get(key)!.collected += Number(pay.amount || 0);
        }
      }
    }
  }

  return Array.from(buckets.values());
}

export interface ActivityFeedItem {
  id: string;
  time: string;
  timestamp: number;
  category: string;
  detail: string;
}

export function buildTodayTimeline(data: HospitalDashboardData): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];

  for (const adm of data.admissions || []) {
    const ts = new Date(adm.admitted_at || adm.created_at).getTime();
    items.push({
      id: `adm-${adm.id}`,
      time: adm.admitted_at,
      timestamp: Number.isNaN(ts) ? 0 : ts,
      category: adm.bed_number ? 'Admission & Bed' : 'OPD Registration',
      detail: `${adm.patient_name} (${adm.mrn}) · ${adm.bed_number ? `Bed ${adm.bed_number}` : 'OPD'}`,
    });
    if (adm.discharged_at) {
      const dts = new Date(adm.discharged_at).getTime();
      items.push({
        id: `dis-${adm.id}`,
        time: adm.discharged_at,
        timestamp: Number.isNaN(dts) ? 0 : dts,
        category: 'Discharge',
        detail: `${adm.patient_name} discharged · INR ${Number(adm.total_billed_amount || 0).toLocaleString()}`,
      });
    }
  }

  for (const appt of (data.appointments || []).slice(0, 10)) {
    const ts = new Date(`${appt.appointment_date}T${appt.time_slot || '09:00'}:00`).getTime();
    items.push({
      id: `appt-${appt.id}`,
      time: `${appt.appointment_date} ${appt.time_slot}`,
      timestamp: Number.isNaN(ts) ? 0 : ts,
      category: 'Appointment',
      detail: `${appt.patient_name} with ${appt.doctor_name} (${appt.status})`,
    });
  }

  for (const emg of data.emergencies || []) {
    const ts = new Date(emg.created_at).getTime();
    items.push({
      id: `emg-${emg.id}`,
      time: emg.created_at,
      timestamp: Number.isNaN(ts) ? 0 : ts,
      category: 'Emergency',
      detail: `${emg.emergency_type} (${emg.severity}) · ${emg.status}`,
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
}

export interface OperationalAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  targetTab: string;
  actionLabel: string;
}

export function buildOperationalAlerts(data: HospitalDashboardData): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  if (data.stats.icu_total > 0 && data.stats.icu_available === 0) {
    alerts.push({
      id: 'icu-full',
      level: 'critical',
      title: 'ICU Capacity Exhausted',
      detail: `All ${data.stats.icu_total} ICU beds are currently occupied or unavailable.`,
      targetTab: 'beds',
      actionLabel: 'Manage Beds',
    });
  } else if (data.stats.total > 0 && data.stats.available / data.stats.total <= 0.2) {
    alerts.push({
      id: 'beds-low',
      level: 'warning',
      title: 'Low Hospital Bed Availability',
      detail: `Only ${data.stats.available} of ${data.stats.total} beds remain available.`,
      targetTab: 'beds',
      actionLabel: 'Inspect Wards',
    });
  }

  const criticalEmergencies = (data.emergencies || []).filter((e) => e.status !== 'resolved');
  if (criticalEmergencies.length > 0) {
    alerts.push({
      id: 'emg-active',
      level: criticalEmergencies.some((e) => e.severity === 'critical') ? 'critical' : 'warning',
      title: `${criticalEmergencies.length} Active Emergency Case${criticalEmergencies.length > 1 ? 's' : ''}`,
      detail: criticalEmergencies[0].emergency_type + ` · ${criticalEmergencies[0].status.replace('_', ' ')}`,
      targetTab: 'emergency',
      actionLabel: 'Open Dispatch',
    });
  }

  if (data.stats.pending_doctor_verifications > 0) {
    alerts.push({
      id: 'doc-pending',
      level: 'info',
      title: `${data.stats.pending_doctor_verifications} Pending Doctor Approval${data.stats.pending_doctor_verifications > 1 ? 's' : ''}`,
      detail: 'Credential verification awaiting hospital review.',
      targetTab: 'staff',
      actionLabel: 'Review Credentials',
    });
  }

  const pendingBills = (data.payments || []).filter((p) => p.status === 'pending');
  if (pendingBills.length > 0) {
    const sum = pendingBills.reduce((s, p) => s + Number(p.amount || 0), 0);
    alerts.push({
      id: 'bills-pending',
      level: 'warning',
      title: `${pendingBills.length} Pending Patient Invoice${pendingBills.length > 1 ? 's' : ''}`,
      detail: `INR ${sum.toLocaleString()} outstanding balance awaiting settlement.`,
      targetTab: 'billing',
      actionLabel: 'View Billing',
    });
  }

  return alerts;
}

export function exportHospitalCsv(data: HospitalDashboardData) {
  const rows = [
    ['Section', 'Metric', 'Value'],
    ['Hospital', 'Name', data.hospital?.name || ''],
    ['Beds', 'Total Beds', String(data.stats.total)],
    ['Beds', 'Occupied Beds', String(data.stats.occupied)],
    ['Beds', 'Available Beds', String(data.stats.available)],
    ['Beds', 'Maintenance Beds', String(data.stats.maintenance)],
    ['Patients', 'Unique Patients', String(data.stats.total_patients)],
    ['Patients', 'Currently Admitted IPD', String(data.stats.active_inpatients)],
    ['Patients', 'OPD Visits', String(data.stats.opd_visits)],
    ['Workforce', 'Verified Doctors', String(data.stats.verified_doctors)],
    ['Workforce', 'Pending Doctor Approvals', String(data.stats.pending_doctor_verifications)],
    ['Workforce', 'Hospital Staff Count', String((data.staff || []).length)],
    ['Financial', 'Total Billed Revenue (INR)', String(data.stats.revenue_total)],
    ['Financial', 'Collected Revenue (INR)', String(data.stats.collected_revenue)],
    ['Financial', 'Pending Payments (INR)', String(data.stats.pending_payments_total)],
    ['Financial', 'Insurance Covered (INR)', String(data.stats.insurance_covered)],
  ];

  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `careone-hospital-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
