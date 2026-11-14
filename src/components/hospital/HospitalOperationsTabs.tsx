import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeftRight,
  BedDouble,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { StatusBadge } from '../StatusBadge.tsx';
import { HorizontalBarList } from '../HospitalCharts.tsx';
import { buildWardStats, type HospitalDashboardData } from './hospitalAnalytics.ts';

/* ============================================================================
 * 6. BEDS & WARDS PAGE
 * ========================================================================== */
interface BedsWardsTabProps {
  data: HospitalDashboardData;
  onCreateBed: (payload: {
    ward_name: string;
    bed_number: string;
    bed_type: 'general' | 'private' | 'icu' | 'emergency';
    daily_rate: number;
  }) => Promise<boolean>;
  onToggleBedStatus: (bedId: number, status: 'available' | 'maintenance' | 'reserved') => Promise<void>;
  onOpenTransferForBed: (bed: any) => void;
}

export function BedsWardsTab({
  data,
  onCreateBed,
  onToggleBedStatus,
  onOpenTransferForBed,
}: BedsWardsTabProps) {
  const [wardFilter, setWardFilter] = useState<'all' | 'general' | 'private' | 'icu' | 'emergency'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showAddForm, setShowAddForm] = useState(false);

  const [bedWard, setBedWard] = useState('Intensive Care Unit 1');
  const [bedNum, setBedNum] = useState('');
  const [bedType, setBedType] = useState<'general' | 'private' | 'icu' | 'emergency'>('general');
  const [bedRate, setBedRate] = useState('2500');

  const wardStats = buildWardStats(data.beds);

  const filteredBeds = useMemo(() => {
    return (data.beds || []).filter((b) => {
      if (wardFilter !== 'all' && b.bed_type !== wardFilter) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          String(b.bed_number).toLowerCase().includes(q) ||
          String(b.ward_name).toLowerCase().includes(q) ||
          String(b.patient_name || '').toLowerCase().includes(q) ||
          String(b.patient_mrn || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [data.beds, wardFilter, statusFilter, search]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onCreateBed({
      ward_name: bedWard,
      bed_number: bedNum,
      bed_type: bedType,
      daily_rate: Number(bedRate),
    });
    if (ok) {
      setBedNum('');
      setShowAddForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Beds & Wards</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Real-time ward capacity, bed allocation, and transfer control
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="hosp-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bed</span>
        </button>
      </div>

      {/* Top Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Total Beds</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#202124]">{data.stats.total}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Occupied Beds</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#5350cc]">{data.stats.occupied}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Available Beds</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#067647]">{data.stats.available}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Under Maintenance</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#B45309]">{data.stats.maintenance}</p>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="hosp-card grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Ward Name</label>
            <input
              required
              value={bedWard}
              onChange={(e) => setBedWard(e.target.value)}
              className="hosp-input w-full px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Bed Number</label>
            <input
              required
              value={bedNum}
              onChange={(e) => setBedNum(e.target.value)}
              placeholder="ICU-03"
              className="hosp-input w-full px-3 py-2 text-[13px] font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Ward Type</label>
            <select
              value={bedType}
              onChange={(e) => setBedType(e.target.value as any)}
              className="hosp-input w-full px-3 py-2 text-[13px]"
            >
              <option value="general">General Ward</option>
              <option value="private">Private Rooms</option>
              <option value="icu">ICU</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Daily Rate (INR)</label>
            <input
              type="number"
              required
              value={bedRate}
              onChange={(e) => setBedRate(e.target.value)}
              className="hosp-input w-full px-3 py-2 text-[13px] font-mono-tabular"
            />
          </div>
          <button type="submit" className="hosp-btn-primary py-2 px-4 text-[13px]">
            Save Bed
          </button>
        </form>
      )}

      {/* Ward-wise Visualization & Availability Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 hosp-card space-y-4">
          <h2 className="text-[16px] font-semibold text-[#202124]">Ward Occupancy Chart</h2>
          <HorizontalBarList
            items={wardStats.map((w) => ({
              label: w.label,
              value: w.occupancyPct,
              sublabel: `${w.occupied} occupied · ${w.available} available · ${w.maintenance} maintenance`,
              color: w.occupancyPct >= 80 ? '#DC2626' : '#5350cc',
            }))}
            unit="%"
          />
        </div>

        <div className="lg:col-span-6 hosp-card space-y-4">
          <h2 className="text-[16px] font-semibold text-[#202124]">Bed Availability Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            {wardStats.map((w) => (
              <button
                key={w.bedType}
                type="button"
                onClick={() => setWardFilter(wardFilter === w.bedType ? 'all' : w.bedType)}
                className={`text-left p-3.5 rounded-lg border transition-colors ${
                  wardFilter === w.bedType
                    ? 'border-[#5350cc] bg-[#F7F8FA]'
                    : 'border-[#E5E7EB] bg-white hover:bg-[#F7F8FA]'
                }`}
              >
                <p className="text-[13px] font-semibold text-[#202124]">{w.label}</p>
                <p className="text-[18px] font-semibold font-mono-tabular text-[#067647] mt-1">
                  {w.available} <span className="text-[12px] font-normal text-[#777D87]">free of {w.total}</span>
                </p>
                <p className="text-[11px] text-[#777D87] mt-1 font-mono-tabular">
                  {w.occupied} occ · {w.reserved} res · {w.maintenance} maint
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters + Directory */}
      <div className="hosp-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-4 h-4 text-[#A0A5AE] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bed, ward, patient..."
                className="hosp-input w-full pl-9 pr-3 py-1.5 text-[13px]"
              />
            </div>
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value as any)}
              className="hosp-input px-3 py-1.5 text-[13px]"
            >
              <option value="all">All Wards</option>
              <option value="general">General Ward</option>
              <option value="private">Private Rooms</option>
              <option value="icu">ICU</option>
              <option value="emergency">Emergency</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="hosp-input px-3 py-1.5 text-[13px]"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="maintenance">Under Maintenance</option>
            </select>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
            {(['table', 'grid'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 text-[12px] font-medium rounded-md capitalize ${
                  viewMode === m ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {filteredBeds.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#777D87]">No beds match the selected filters.</p>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-5 py-3 font-medium">Bed ID</th>
                  <th className="px-5 py-3 font-medium">Ward & Category</th>
                  <th className="px-5 py-3 font-medium">Allocated Patient</th>
                  <th className="px-5 py-3 font-medium">Rate / Day</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredBeds.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F7F8FA] transition-colors">
                    <td className="px-5 py-3 font-mono-tabular font-semibold text-[#202124]">{b.bed_number}</td>
                    <td className="px-5 py-3">
                      <p className="text-[#202124] font-medium">{b.ward_name}</p>
                      <p className="text-[11px] uppercase text-[#777D87]">{b.bed_type}</p>
                    </td>
                    <td className="px-5 py-3 text-[#202124]">
                      {b.patient_name ? (
                        <span>
                          {b.patient_name}{' '}
                          <span className="text-[11px] font-mono-tabular text-[#777D87]">({b.patient_mrn})</span>
                        </span>
                      ) : (
                        <span className="text-[#A0A5AE]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono-tabular text-[#202124]">INR {b.daily_rate}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={b.status === 'maintenance' ? 'maintenance' : b.status} variant="hospital" />
                    </td>
                    <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                      {b.status === 'occupied' ? (
                        <button
                          type="button"
                          onClick={() => onOpenTransferForBed(b)}
                          className="hosp-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[12px]"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Transfer</span>
                        </button>
                      ) : (
                        <>
                          {(b.status === 'available' || b.status === 'reserved') && (
                            <button
                              type="button"
                              onClick={() => onOpenTransferForBed(b)}
                              className="hosp-btn-secondary px-2.5 py-1 text-[12px] text-[#16165c]"
                            >
                              Allocate
                            </button>
                          )}
                          {b.status !== 'reserved' && (
                            <button
                              type="button"
                              onClick={() => onToggleBedStatus(b.id, 'reserved')}
                              className="text-[12px] font-medium text-[#0369A1] hover:underline"
                            >
                              Reserve
                            </button>
                          )}
                          {b.status !== 'maintenance' ? (
                            <button
                              type="button"
                              onClick={() => onToggleBedStatus(b.id, 'maintenance')}
                              className="text-[12px] font-medium text-[#B45309] hover:underline"
                            >
                              Maintenance
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggleBedStatus(b.id, 'available')}
                              className="text-[12px] font-medium text-[#067647] hover:underline"
                            >
                              Mark Available
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBeds.map((b) => (
              <div key={b.id} className="hosp-card-compact space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-[#5350cc]" />
                    <span className="font-mono-tabular text-[15px] font-semibold text-[#202124]">{b.bed_number}</span>
                  </div>
                  <StatusBadge status={b.status} variant="hospital" />
                </div>
                <p className="text-[12px] text-[#777D87]">
                  {b.ward_name} · <span className="uppercase">{b.bed_type}</span> ·{' '}
                  <span className="font-mono-tabular text-[#202124]">INR {b.daily_rate}/day</span>
                </p>
                <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-[#202124] truncate">
                    {b.patient_name ? `${b.patient_name} (${b.patient_mrn})` : 'Unassigned'}
                  </span>
                  {b.status === 'occupied' ? (
                    <button
                      type="button"
                      onClick={() => onOpenTransferForBed(b)}
                      className="text-[#5350cc] font-medium hover:underline shrink-0"
                    >
                      Transfer
                    </button>
                  ) : b.status === 'maintenance' ? (
                    <button
                      type="button"
                      onClick={() => onToggleBedStatus(b.id, 'available')}
                      className="text-[#067647] font-medium hover:underline shrink-0"
                    >
                      Mark Available
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleBedStatus(b.id, 'maintenance')}
                      className="text-[#B45309] font-medium hover:underline shrink-0"
                    >
                      Maintenance
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 7. ADMISSIONS & OPD PAGE
 * ========================================================================== */
interface AdmissionsOpdTabProps {
  data: HospitalDashboardData;
  onOpenRegisterModal: () => void;
  onOpenAdmitModal: () => void;
  onOpenDischargeModal: (adm: any) => void;
  onOpenTransferModal: (adm: any) => void;
}

export function AdmissionsOpdTab({
  data,
  onOpenRegisterModal,
  onOpenAdmitModal,
  onOpenDischargeModal,
  onOpenTransferModal,
}: AdmissionsOpdTabProps) {
  const [queueTab, setQueueTab] = useState<'all' | 'opd' | 'ipd' | 'history'>('all');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const departments = useMemo(
    () => Array.from(new Set<string>((data.admissions || []).map((a) => a.department || 'General Medicine'))),
    [data.admissions]
  );

  const filteredAdmissions = useMemo(() => {
    return (data.admissions || []).filter((adm) => {
      if (queueTab === 'opd' && adm.admission_type !== 'opd') return false;
      if (queueTab === 'ipd' && (adm.admission_type === 'opd' || adm.status !== 'admitted')) return false;
      if (queueTab === 'history' && adm.status !== 'discharged') return false;
      if (deptFilter !== 'all' && (adm.department || 'General Medicine') !== deptFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          String(adm.patient_name).toLowerCase().includes(q) ||
          String(adm.mrn).toLowerCase().includes(q) ||
          String(adm.doctor_name || '').toLowerCase().includes(q) ||
          String(adm.diagnosis || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [data.admissions, queueTab, deptFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAdmissions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredAdmissions.slice((safePage - 1) * pageSize, safePage * pageSize);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todaysOpdCount = (data.admissions || []).filter(
    (a) => a.admission_type === 'opd' && String(a.admitted_at || '').slice(0, 10) === todayIso
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Admissions & OPD</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Patient registration, OPD queue, inpatient admissions, and discharges
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
          >
            <UserPlus className="w-4 h-4 text-[#5350cc]" />
            <span>Register Patient</span>
          </button>
          <button
            type="button"
            onClick={onOpenAdmitModal}
            className="hosp-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Admission / OPD</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Today's OPD</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#0369A1]">
            {todaysOpdCount}
          </p>
          <p className="text-[11px] text-[#777D87] mt-1 font-mono-tabular">Total OPD: {data.stats.opd_visits}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Current IPD</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#16165c]">
            {data.stats.active_inpatients}
          </p>
          <p className="text-[11px] text-[#777D87] mt-1">Active inpatient beds</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">New Admissions Today</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#5350cc]">
            {data.stats.today_admissions}
          </p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Discharges Today</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#067647]">
            {data.stats.today_discharges}
          </p>
        </div>
      </div>

      {/* Professional Table */}
      <div className="hosp-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
            {(
              [
                { id: 'all', label: 'All Records' },
                { id: 'opd', label: 'OPD Queue' },
                { id: 'ipd', label: 'IPD List' },
                { id: 'history', label: 'History' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setQueueTab(t.id);
                  setPage(1);
                }}
                className={`px-3 py-1 text-[12px] font-medium rounded-md whitespace-nowrap ${
                  queueTab === t.id ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87] hover:text-[#202124]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-[#A0A5AE] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search MRN, patient, doctor..."
                className="hosp-input pl-9 pr-3 py-1.5 text-[13px]"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(1);
              }}
              className="hosp-input px-3 py-1.5 text-[13px]"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pageRows.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#777D87]">No admission or OPD records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-5 py-3 font-medium">Patient ID</th>
                  <th className="px-5 py-3 font-medium">Patient Name</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Assigned Doctor</th>
                  <th className="px-5 py-3 font-medium">Admission Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {pageRows.map((adm) => (
                  <tr key={adm.id} className="hover:bg-[#F7F8FA] transition-colors">
                    <td className="px-5 py-3 font-mono-tabular text-[#202124] whitespace-nowrap">{adm.mrn}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#202124]">{adm.patient_name}</p>
                      <p className="text-[11px] text-[#777D87] uppercase">
                        {adm.admission_type} · {adm.bed_number || 'OPD'}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-[#202124]">{adm.department || 'General Medicine'}</td>
                    <td className="px-5 py-3 text-[#777D87]">{adm.doctor_name || 'Duty Attending'}</td>
                    <td className="px-5 py-3 font-mono-tabular text-[#777D87] whitespace-nowrap">
                      {String(adm.admitted_at || '').slice(0, 10)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={adm.status} variant="hospital" />
                    </td>
                    <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                      {adm.status === 'admitted' && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenTransferModal(adm)}
                            className="hosp-btn-secondary px-2.5 py-1 text-[12px]"
                          >
                            {adm.bed_number ? 'Transfer Bed' : 'Assign Bed'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDischargeModal(adm)}
                            className="hosp-btn-primary px-3 py-1 text-[12px]"
                          >
                            Discharge
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-between text-[12px] text-[#777D87]">
          <span className="font-mono-tabular">
            Showing {pageRows.length} of {filteredAdmissions.length} records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="hosp-btn-secondary px-2.5 py-1 text-[12px] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono-tabular text-[#202124]">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="hosp-btn-secondary px-2.5 py-1 text-[12px] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 8. DOCTORS & STAFF PAGE
 * ========================================================================== */
interface DoctorsStaffTabProps {
  data: HospitalDashboardData;
  onVerifyDoctor: (doctorId: number, status: 'verified' | 'rejected') => Promise<void>;
  onOpenAddDoctorModal: () => void;
  onAddStaff: (payload: {
    full_name: string;
    role_title: string;
    department: string;
    staff_role: 'nurse' | 'coordinator' | 'billing' | 'admin' | 'technician';
    shift_schedule: string;
    phone: string;
  }) => Promise<boolean>;
}

export function DoctorsStaffTab({
  data,
  onVerifyDoctor,
  onOpenAddDoctorModal,
  onAddStaff,
}: DoctorsStaffTabProps) {
  const [subTab, setSubTab] = useState<'doctors' | 'staff'>('doctors');
  const [search, setSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null);
  const [showStaffForm, setShowStaffForm] = useState(false);

  const [staffName, setStaffName] = useState('');
  const [staffTitle, setStaffTitle] = useState('');
  const [staffDept, setStaffDept] = useState('Critical Care ICU');
  const [staffRole, setStaffRole] = useState<'nurse' | 'coordinator' | 'billing' | 'admin' | 'technician'>('nurse');
  const [staffShift, setStaffShift] = useState('Morning (07:00 - 15:00)');
  const [staffPhone, setStaffPhone] = useState('');

  const doctors = data.doctors || [];
  const staff = data.staff || [];
  const verifiedDocs = doctors.filter((d) => d.verification_status === 'verified');
  const pendingDocs = doctors.filter((d) => d.verification_status === 'pending');

  const filteredDoctors = doctors.filter(
    (d) =>
      !search ||
      String(d.full_name).toLowerCase().includes(search.toLowerCase()) ||
      String(d.specialization).toLowerCase().includes(search.toLowerCase()) ||
      String(d.license_no).toLowerCase().includes(search.toLowerCase())
  );

  const filteredStaff = staff.filter(
    (s) =>
      !search ||
      String(s.full_name).toLowerCase().includes(search.toLowerCase()) ||
      String(s.role_title).toLowerCase().includes(search.toLowerCase()) ||
      String(s.department).toLowerCase().includes(search.toLowerCase())
  );

  const handleStaffSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onAddStaff({
      full_name: staffName,
      role_title: staffTitle,
      department: staffDept,
      staff_role: staffRole,
      shift_schedule: staffShift,
      phone: staffPhone,
    });
    if (ok) {
      setStaffName('');
      setStaffTitle('');
      setStaffPhone('');
      setShowStaffForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Doctors & Staff</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Medical credential verification, physician schedules, and hospital workforce roster
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSubTab('staff');
              setShowStaffForm((v) => !v);
            }}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px]"
          >
            <Plus className="w-4 h-4 text-[#5350cc]" />
            <span>Add Staff</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddDoctorModal}
            className="hosp-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Add Doctor</span>
          </button>
        </div>
      </div>

      {/* Workforce Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Total Doctors</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#202124]">{doctors.length}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Doctors on Duty</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#16165c]">{verifiedDocs.length}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Available Doctors</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#067647]">
            {verifiedDocs.filter((d) => d.is_available_for_video !== 0).length}
          </p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Pending Approvals</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#B45309]">{pendingDocs.length}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Total Staff</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#5350cc]">{staff.length}</p>
        </div>
      </div>

      {showStaffForm && (
        <form onSubmit={handleStaffSubmit} className="hosp-card space-y-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Add Hospital Staff Member</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Full Name"
              className="hosp-input px-3 py-2 text-[13px]"
            />
            <input
              required
              value={staffTitle}
              onChange={(e) => setStaffTitle(e.target.value)}
              placeholder="Role Title"
              className="hosp-input px-3 py-2 text-[13px]"
            />
            <input
              required
              value={staffDept}
              onChange={(e) => setStaffDept(e.target.value)}
              placeholder="Department"
              className="hosp-input px-3 py-2 text-[13px]"
            />
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as any)}
              className="hosp-input px-3 py-2 text-[13px]"
            >
              <option value="nurse">Nurse</option>
              <option value="coordinator">Coordinator</option>
              <option value="billing">Billing Officer</option>
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
            <input
              required
              value={staffShift}
              onChange={(e) => setStaffShift(e.target.value)}
              placeholder="Shift Schedule"
              className="hosp-input px-3 py-2 text-[13px]"
            />
            <button type="submit" className="hosp-btn-primary px-4 py-2 text-[13px]">
              Save Staff
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className={`${selectedDoctor ? 'lg:col-span-8' : 'lg:col-span-12'} hosp-card p-0 overflow-hidden`}>
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
              <button
                type="button"
                onClick={() => setSubTab('doctors')}
                className={`px-3 py-1 text-[12px] font-medium rounded-md ${
                  subTab === 'doctors' ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87]'
                }`}
              >
                Doctors Directory ({doctors.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('staff')}
                className={`px-3 py-1 text-[12px] font-medium rounded-md ${
                  subTab === 'staff' ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87]'
                }`}
              >
                Staff Roster ({staff.length})
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#A0A5AE] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={subTab === 'doctors' ? 'Search doctor or license...' : 'Search staff or department...'}
                className="hosp-input pl-9 pr-3 py-1.5 text-[13px]"
              />
            </div>
          </div>

          {subTab === 'doctors' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Doctor</th>
                    <th className="px-5 py-3 font-medium">Department</th>
                    <th className="px-5 py-3 font-medium">License</th>
                    <th className="px-5 py-3 font-medium">Duty Schedule</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredDoctors.map((d) => (
                    <tr key={d.id} className="hover:bg-[#F7F8FA] transition-colors">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDoctor(d)}
                          className="font-semibold text-[#16165c] hover:underline text-left"
                        >
                          {d.full_name}
                        </button>
                        <p className="text-[11px] text-[#777D87]">{d.qualification}</p>
                      </td>
                      <td className="px-5 py-3 text-[#202124]">{d.specialization}</td>
                      <td className="px-5 py-3 font-mono-tabular text-[#777D87]">{d.license_no}</td>
                      <td className="px-5 py-3 font-mono-tabular text-[#777D87] whitespace-nowrap">
                        {d.slot_start_time}–{d.slot_end_time}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={d.verification_status} variant="hospital" />
                      </td>
                      <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedDoctor(d)}
                          className="hosp-btn-secondary px-2.5 py-1 text-[12px]"
                        >
                          Profile
                        </button>
                        {d.verification_status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onVerifyDoctor(d.id, 'verified')}
                              className="hosp-btn-primary px-2.5 py-1 text-[12px]"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => onVerifyDoctor(d.id, 'rejected')}
                              className="hosp-btn-secondary px-2.5 py-1 text-[12px] text-[#B91C1C]"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Staff Member</th>
                    <th className="px-5 py-3 font-medium">Role Title</th>
                    <th className="px-5 py-3 font-medium">Department</th>
                    <th className="px-5 py-3 font-medium">Shift Schedule</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F7F8FA] transition-colors">
                      <td className="px-5 py-3 font-semibold text-[#202124]">{s.full_name}</td>
                      <td className="px-5 py-3 text-[#202124]">{s.role_title}</td>
                      <td className="px-5 py-3 text-[#777D87]">{s.department}</td>
                      <td className="px-5 py-3 font-mono-tabular text-[#777D87]">{s.shift_schedule}</td>
                      <td className="px-5 py-3 font-mono-tabular text-[#777D87]">{s.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedDoctor && (
          <div className="lg:col-span-4 hosp-card space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5350cc]">Physician Profile</p>
                <h3 className="text-[17px] font-semibold text-[#202124] mt-0.5">{selectedDoctor.full_name}</h3>
                <p className="text-[12px] text-[#777D87]">{selectedDoctor.specialization}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                className="text-[12px] text-[#777D87] hover:text-[#202124]"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-[13px] pt-2 border-t border-[#E5E7EB]">
              <p>
                <span className="text-[#777D87]">Qualification:</span>{' '}
                <span className="text-[#202124]">{selectedDoctor.qualification}</span>
              </p>
              <p>
                <span className="text-[#777D87]">License No:</span>{' '}
                <span className="font-mono-tabular text-[#202124]">{selectedDoctor.license_no}</span>
              </p>
              <p>
                <span className="text-[#777D87]">Experience:</span>{' '}
                <span className="font-mono-tabular text-[#202124]">{selectedDoctor.experience_years} yrs</span>
              </p>
              <p>
                <span className="text-[#777D87]">Fee:</span>{' '}
                <span className="font-mono-tabular text-[#202124]">INR {selectedDoctor.consultation_fee}</span>
              </p>
              <p>
                <span className="text-[#777D87]">Hours:</span>{' '}
                <span className="font-mono-tabular text-[#202124]">
                  {selectedDoctor.slot_start_time}–{selectedDoctor.slot_end_time}
                </span>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <ShieldCheck className="w-4 h-4 text-[#5350cc]" />
                <StatusBadge status={selectedDoctor.verification_status} variant="hospital" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 9. EMERGENCY PAGE
 * ========================================================================== */
interface EmergencyOpsTabProps {
  data: HospitalDashboardData;
  onUpdateEmergency: (
    id: number,
    payload: {
      status: 'dispatched' | 'en_route' | 'arrived' | 'admitted' | 'resolved';
      ambulance_unit?: string;
      eta_minutes?: number | null;
      assigned_doctor_id?: number | null;
      department?: string;
      bed_id?: number | null;
    }
  ) => Promise<void>;
}

export function EmergencyOpsTab({ data, onUpdateEmergency }: EmergencyOpsTabProps) {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'moderate'>('all');
  const [dispatchUnit, setDispatchUnit] = useState<Record<number, string>>({});
  const [dispatchEta, setDispatchEta] = useState<Record<number, string>>({});
  const [docAssign, setDocAssign] = useState<Record<number, string>>({});
  const [deptAssign, setDeptAssign] = useState<Record<number, string>>({});
  const [bedAssign, setBedAssign] = useState<Record<number, string>>({});

  const emergencies = data.emergencies || [];
  const activeCount = emergencies.filter((e) => e.status !== 'resolved').length;
  const newRequestsCount = emergencies.filter((e) => e.status === 'requested').length;
  const underTreatmentCount = emergencies.filter((e) =>
    ['dispatched', 'en_route', 'arrived', 'admitted'].includes(e.status)
  ).length;
  const completedCount = emergencies.filter((e) => e.status === 'resolved').length;

  const filtered = emergencies.filter((e) => severityFilter === 'all' || e.severity === severityFilter);
  const emergencyBeds = (data.beds || []).filter(
    (b) => b.status === 'available' || b.status === 'reserved'
  );
  const verifiedDoctors = (data.doctors || []).filter((d) => d.verification_status === 'verified');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Emergency Operations</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Triage queue, ambulance dispatch, doctor assignment, and emergency bed reservation
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
          {(['all', 'critical', 'high', 'moderate'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 text-[12px] font-medium rounded-md capitalize ${
                severityFilter === sev ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87]'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Active Emergency Cases</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#B91C1C]">{activeCount}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">New Requests</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#0369A1]">{newRequestsCount}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Cases Under Treatment</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#B45309]">{underTreatmentCount}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Completed Cases</p>
          <p className="mt-1.5 text-[26px] font-semibold font-mono-tabular text-[#067647]">{completedCount}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="hosp-card text-center py-12 text-[13px] text-[#777D87]">
          No emergency requests in this priority category.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((er) => {
            const isCritical = er.severity === 'critical' && er.status !== 'resolved';
            return (
              <div
                key={er.id}
                className={`hosp-card space-y-4 ${isCritical ? 'border-[#FCA5A5]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15px] font-semibold text-[#202124]">{er.emergency_type}</h3>
                      <StatusBadge status={er.severity} variant="hospital" />
                    </div>
                    <p className="text-[12px] text-[#777D87] mt-1">
                      {er.patient_name || 'Walk-in / Caller'} {er.mrn ? `(${er.mrn})` : ''} · {er.pickup_location} ·{' '}
                      <span className="font-mono-tabular text-[#202124]">{er.contact_phone}</span>
                    </p>
                  </div>
                  <StatusBadge status={er.status} variant="hospital" />
                </div>

                {er.description && (
                  <p className="text-[12px] text-[#202124] bg-[#F7F8FA] px-3 py-2 rounded-lg border border-[#E5E7EB]">
                    {er.description}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[12px]">
                  <div>
                    <label className="block text-[11px] text-[#777D87] mb-1">Assigned Doctor</label>
                    <select
                      value={docAssign[er.id] ?? (er.assigned_doctor_id ? String(er.assigned_doctor_id) : '')}
                      onChange={(e) => setDocAssign({ ...docAssign, [er.id]: e.target.value })}
                      className="hosp-input w-full px-2.5 py-1.5 text-[12px]"
                    >
                      <option value="">Unassigned</option>
                      {verifiedDoctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#777D87] mb-1">Emergency Dept</label>
                    <input
                      value={deptAssign[er.id] ?? er.department ?? 'Emergency Medicine'}
                      onChange={(e) => setDeptAssign({ ...deptAssign, [er.id]: e.target.value })}
                      className="hosp-input w-full px-2.5 py-1.5 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#777D87] mb-1">Reserve Bed</label>
                    <select
                      value={bedAssign[er.id] ?? (er.bed_id ? String(er.bed_id) : '')}
                      onChange={(e) => setBedAssign({ ...bedAssign, [er.id]: e.target.value })}
                      className="hosp-input w-full px-2.5 py-1.5 text-[12px]"
                    >
                      <option value="">{er.bed_number ? `Bed ${er.bed_number}` : 'No bed reserved'}</option>
                      {emergencyBeds.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bed_number} ({b.bed_type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    placeholder="Ambulance Unit (e.g. ALS-04)"
                    value={dispatchUnit[er.id] ?? er.ambulance_unit ?? ''}
                    onChange={(e) => setDispatchUnit({ ...dispatchUnit, [er.id]: e.target.value })}
                    className="hosp-input px-3 py-1.5 text-[12px] font-mono-tabular"
                  />
                  <input
                    type="number"
                    placeholder="ETA (min)"
                    value={dispatchEta[er.id] ?? er.eta_minutes ?? ''}
                    onChange={(e) => setDispatchEta({ ...dispatchEta, [er.id]: e.target.value })}
                    className="hosp-input px-3 py-1.5 text-[12px] font-mono-tabular"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(['dispatched', 'en_route', 'arrived', 'admitted', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        onUpdateEmergency(er.id, {
                          status: st,
                          ambulance_unit: dispatchUnit[er.id] || er.ambulance_unit || undefined,
                          eta_minutes:
                            dispatchEta[er.id] !== undefined && dispatchEta[er.id] !== ''
                              ? Number(dispatchEta[er.id])
                              : er.eta_minutes ?? undefined,
                          assigned_doctor_id: docAssign[er.id] ? Number(docAssign[er.id]) : er.assigned_doctor_id ?? undefined,
                          department: deptAssign[er.id] || er.department || 'Emergency Medicine',
                          bed_id: bedAssign[er.id] ? Number(bedAssign[er.id]) : er.bed_id ?? undefined,
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-colors ${
                        er.status === st ? 'bg-[#16165c] text-white' : 'hosp-btn-secondary'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
