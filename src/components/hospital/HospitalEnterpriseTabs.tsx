import { useMemo, useState, type FormEvent } from 'react';
import {
  CheckCheck,
  Download,
  Plus,
  Search,
} from 'lucide-react';
import { StatusBadge } from '../StatusBadge.tsx';
import {
  ActivityLineChart,
  DonutChart,
  HorizontalBarList,
  RevenueBarChart,
} from '../HospitalCharts.tsx';
import {
  buildActivitySeries,
  buildRevenueSeries,
  buildWardStats,
  exportHospitalCsv,
  type HospitalDashboardData,
} from './hospitalAnalytics.ts';

/* ============================================================================
 * 10. BILLING PAGE
 * ========================================================================== */
interface BillingTabProps {
  data: HospitalDashboardData;
  payments: any[];
  onOpenCreateBill: () => void;
  onMarkBillPaid: (billId: number) => Promise<void>;
}

export function BillingTab({
  data,
  payments,
  onOpenCreateBill,
  onMarkBillPaid,
}: BillingTabProps) {
  const [ledgerTab, setLedgerTab] = useState<'invoices' | 'pending' | 'history' | 'insurance'>('invoices');
  const [search, setSearch] = useState('');

  const revenueSeries = buildRevenueSeries(data, 'monthly');

  const paidPayments = payments.filter((p) => p.status === 'paid');
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const otherPayments = payments.filter((p) => p.status === 'failed' || p.status === 'refunded');
  const insuranceAdmissions = (data.admissions || []).filter((a) => Number(a.insurance_covered_amount || 0) > 0);

  const revenueByDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const adm of data.admissions || []) {
      const dept = adm.department || 'General Medicine';
      map.set(dept, (map.get(dept) || 0) + Number(adm.total_billed_amount || 0));
    }
    return Array.from(map.entries())
      .filter(([, v]) => v > 0)
      .map(([label, value], i) => ({
        label,
        value,
        color: i % 2 === 0 ? '#16165c' : '#5350cc',
      }))
      .sort((a, b) => b.value - a.value);
  }, [data.admissions]);

  const filteredPayments = useMemo(() => {
    const base =
      ledgerTab === 'pending'
        ? pendingPayments
        : ledgerTab === 'history'
          ? paidPayments
          : payments;
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter(
      (p) =>
        String(p.invoice_number).toLowerCase().includes(q) ||
        String(p.patient_name || '').toLowerCase().includes(q) ||
        String(p.mrn || '').toLowerCase().includes(q)
    );
  }, [payments, paidPayments, pendingPayments, ledgerTab, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Billing & Revenue</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Gross billed charges, collected payments, pending balances, and insurance claims
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateBill}
          className="hosp-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Bill</span>
        </button>
      </div>

      {/* Distinct Billing KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Total Billed Revenue</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#5350cc]">
            INR {data.stats.revenue_total.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#777D87] mt-1">Gross hospital charges</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Collected Revenue</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#067647]">
            INR {data.stats.collected_revenue.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#777D87] mt-1">Settled patient payments</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Pending Payments</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#B45309]">
            INR {data.stats.pending_payments_total.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#777D87] mt-1 font-mono-tabular">
            {pendingPayments.length} unpaid invoice{pendingPayments.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Insurance Claims</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#0369A1]">
            INR {data.stats.insurance_covered.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#777D87] mt-1 font-mono-tabular">
            {insuranceAdmissions.length} covered admission{insuranceAdmissions.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 hosp-card space-y-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Monthly Billed vs Collected</h2>
          <RevenueBarChart data={revenueSeries} />
        </div>

        <div className="lg:col-span-4 hosp-card space-y-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Payment Status Distribution</h2>
          <DonutChart
            centerLabel="Invoices"
            centerValue={payments.length}
            slices={[
              { label: 'Paid', value: paidPayments.length, color: '#067647' },
              { label: 'Pending', value: pendingPayments.length, color: '#D97706' },
              { label: 'Other', value: otherPayments.length, color: '#A0A5AE' },
            ]}
          />
        </div>

        <div className="lg:col-span-3 hosp-card space-y-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Billed by Department</h2>
          <HorizontalBarList items={revenueByDept} prefix="INR " emptyText="No billed departments yet." />
        </div>
      </div>

      {/* Tables */}
      <div className="hosp-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
            {(
              [
                { id: 'invoices', label: 'Patient Invoices' },
                { id: 'pending', label: `Pending Bills (${pendingPayments.length})` },
                { id: 'history', label: 'Payment History' },
                { id: 'insurance', label: 'Insurance Records' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLedgerTab(t.id)}
                className={`px-3 py-1 text-[12px] font-medium rounded-md whitespace-nowrap ${
                  ledgerTab === t.id ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {ledgerTab !== 'insurance' && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#A0A5AE] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice or patient..."
                className="hosp-input pl-9 pr-3 py-1.5 text-[13px]"
              />
            </div>
          )}
        </div>

        {ledgerTab === 'insurance' ? (
          insuranceAdmissions.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[#777D87]">No insurance claims recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium">Insurer</th>
                    <th className="px-5 py-3 font-medium">Department</th>
                    <th className="px-5 py-3 font-medium text-right">Gross Billed</th>
                    <th className="px-5 py-3 font-medium text-right">Insurance Covered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {insuranceAdmissions.map((adm) => (
                    <tr key={adm.id} className="hover:bg-[#F7F8FA]">
                      <td className="px-5 py-3">
                        <span className="font-semibold text-[#202124]">{adm.patient_name}</span>{' '}
                        <span className="text-[11px] font-mono-tabular text-[#777D87]">({adm.mrn})</span>
                      </td>
                      <td className="px-5 py-3 text-[#202124]">{adm.insurance_provider || 'Hospital Shield'}</td>
                      <td className="px-5 py-3 text-[#777D87]">{adm.department}</td>
                      <td className="px-5 py-3 text-right font-mono-tabular text-[#202124]">
                        INR {Number(adm.total_billed_amount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-[#067647]">
                        INR {Number(adm.insurance_covered_amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredPayments.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#777D87]">No billing records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Net Payable</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F7F8FA]">
                    <td className="px-5 py-3 font-mono-tabular font-medium text-[#202124]">{p.invoice_number}</td>
                    <td className="px-5 py-3 text-[#202124]">
                      {p.patient_name} <span className="text-[11px] font-mono-tabular text-[#777D87]">({p.mrn})</span>
                    </td>
                    <td className="px-5 py-3 text-[#777D87]">{p.department || 'Hospital Services'}</td>
                    <td className="px-5 py-3 font-mono-tabular text-[#777D87]">{String(p.created_at || '').slice(0, 10)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} variant="hospital" />
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-[#202124]">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => onMarkBillPaid(p.id)}
                          className="hosp-btn-secondary px-2.5 py-1 text-[12px] text-[#067647]"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 11. FACILITY PAGE
 * ========================================================================== */
interface FacilityTabProps {
  data: HospitalDashboardData;
  onAddResource: (payload: {
    resource_type: 'ward' | 'room' | 'equipment' | 'laboratory' | 'operation_theatre' | 'facility';
    name: string;
    department: string;
    location: string;
    status: 'operational' | 'in_use' | 'maintenance';
    notes: string;
  }) => Promise<boolean>;
  onUpdateResourceStatus: (id: number, status: 'operational' | 'in_use' | 'maintenance') => Promise<void>;
}

export function FacilityTab({
  data,
  onAddResource,
  onUpdateResourceStatus,
}: FacilityTabProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);

  const [resType, setResType] = useState<'equipment' | 'laboratory' | 'operation_theatre' | 'room' | 'ward' | 'facility'>('equipment');
  const [resName, setResName] = useState('');
  const [resDept, setResDept] = useState('Cardiology');
  const [resLoc, setResLoc] = useState('');
  const [resNotes, setResNotes] = useState('');

  let departments: string[] = [];
  let facilities: string[] = [];
  try {
    departments = JSON.parse(data.hospital?.departments_json || '[]');
    facilities = JSON.parse(data.hospital?.facilities_json || '[]');
  } catch {
    // ignore
  }

  const resources = data.resources || [];
  const filteredResources = resources.filter((r) => typeFilter === 'all' || r.resource_type === typeFilter);
  const wardNames = Array.from(new Set<string>((data.beds || []).map((b) => b.ward_name)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onAddResource({
      resource_type: resType,
      name: resName,
      department: resDept,
      location: resLoc,
      status: 'operational',
      notes: resNotes,
    });
    if (ok) {
      setResName('');
      setResLoc('');
      setResNotes('');
      setShowAdd(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Facility Management</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Departments, wards, specialized rooms, medical equipment, laboratories, and operation theatres
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="hosp-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Equipment / Unit</span>
        </button>
      </div>

      {/* Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Departments</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#16165c]">{departments.length}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Active Wards</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#5350cc]">{wardNames.length}</p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Operational Units</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#067647]">
            {resources.filter((r) => r.status === 'operational' || r.status === 'in_use').length}
          </p>
        </div>
        <div className="hosp-card-compact">
          <p className="text-[12px] font-medium text-[#777D87]">Under Maintenance</p>
          <p className="mt-1.5 text-[24px] font-semibold font-mono-tabular text-[#B45309]">
            {resources.filter((r) => r.status === 'maintenance').length}
          </p>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleSubmit} className="hosp-card space-y-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Register Hospital Equipment / Facility Unit</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={resType}
              onChange={(e) => setResType(e.target.value as any)}
              className="hosp-input px-3 py-2 text-[13px]"
            >
              <option value="equipment">Medical Equipment</option>
              <option value="laboratory">Laboratory</option>
              <option value="operation_theatre">Operation Theatre</option>
              <option value="room">Specialized Room</option>
              <option value="ward">Ward Wing</option>
              <option value="facility">General Facility</option>
            </select>
            <input
              required
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              placeholder="Unit / Equipment Name"
              className="hosp-input px-3 py-2 text-[13px]"
            />
            <input
              required
              value={resDept}
              onChange={(e) => setResDept(e.target.value)}
              placeholder="Department"
              className="hosp-input px-3 py-2 text-[13px]"
            />
            <input
              value={resLoc}
              onChange={(e) => setResLoc(e.target.value)}
              placeholder="Wing / Floor Location"
              className="hosp-input px-3 py-2 text-[13px]"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              value={resNotes}
              onChange={(e) => setResNotes(e.target.value)}
              placeholder="Calibration or availability notes..."
              className="hosp-input flex-1 px-3 py-2 text-[13px]"
            />
            <button type="submit" className="hosp-btn-primary px-5 py-2 text-[13px]">
              Save Unit
            </button>
          </div>
        </form>
      )}

      {/* Departments & Core Facilities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 hosp-card space-y-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Clinical Departments</h2>
          {departments.length === 0 ? (
            <p className="text-[13px] text-[#777D87]">No departments listed in hospital settings.</p>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {departments.map((dept) => {
                const docCount = (data.doctors || []).filter((d) => d.specialization === dept).length;
                return (
                  <div key={dept} className="py-2.5 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-[#202124]">{dept}</span>
                    <span className="text-[12px] font-mono-tabular text-[#777D87]">
                      {docCount} affiliated doctor{docCount === 1 ? '' : 's'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 hosp-card space-y-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Hospital Wards & Core Facilities</h2>
          <div className="space-y-3 text-[13px]">
            <div>
              <p className="text-[12px] font-medium text-[#777D87] mb-1.5">Active Wards</p>
              <p className="text-[#202124]">{wardNames.join(' · ') || 'No wards configured'}</p>
            </div>
            <div className="pt-2 border-t border-[#E5E7EB]">
              <p className="text-[12px] font-medium text-[#777D87] mb-1.5">Verified Facility Capabilities</p>
              <p className="text-[#202124]">{facilities.join(' · ') || 'No facilities listed'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment, Labs, Operation Theatres Table */}
      <div className="hosp-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">Equipment, Laboratories & Operation Theatres</h2>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="hosp-input px-3 py-1.5 text-[13px]"
          >
            <option value="all">All Categories</option>
            <option value="equipment">Medical Equipment</option>
            <option value="laboratory">Laboratories</option>
            <option value="operation_theatre">Operation Theatres</option>
            <option value="room">Specialized Rooms</option>
            <option value="ward">Wards</option>
          </select>
        </div>

        {filteredResources.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#777D87]">No facility units recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-5 py-3 font-medium">Unit Name</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredResources.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F8FA]">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[#202124]">{r.name}</p>
                      {r.notes && <p className="text-[11px] text-[#777D87]">{r.notes}</p>}
                    </td>
                    <td className="px-5 py-3 capitalize text-[#777D87]">{r.resource_type.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-[#202124]">{r.department}</td>
                    <td className="px-5 py-3 text-[#777D87]">{r.location || 'Main Campus'}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} variant="hospital" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <select
                        aria-label={`Status for ${r.name}`}
                        value={r.status}
                        onChange={(e) => onUpdateResourceStatus(r.id, e.target.value as any)}
                        className="hosp-input px-2.5 py-1 text-[12px]"
                      >
                        <option value="operational">Operational</option>
                        <option value="in_use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 12. REPORTS & ANALYTICS PAGE
 * ========================================================================== */
interface ReportsAnalyticsTabProps {
  data: HospitalDashboardData;
  payments: any[];
  dateRange: 7 | 30 | 90;
  onDateRangeChange: (d: 7 | 30 | 90) => void;
}

export function ReportsAnalyticsTab({
  data,
  payments,
  dateRange,
  onDateRangeChange,
}: ReportsAnalyticsTabProps) {
  const activitySeries = buildActivitySeries(data, dateRange);
  const wardStats = buildWardStats(data.beds);
  const revenueSeries = buildRevenueSeries(data, 'monthly');

  const ipdCount = (data.admissions || []).filter((a) => a.admission_type !== 'opd').length;
  const opdCount = (data.admissions || []).filter((a) => a.admission_type === 'opd').length;

  const doctorWorkload = useMemo(() => {
    return (data.doctors || [])
      .filter((d) => d.verification_status === 'verified')
      .map((doc) => {
        const apptCount = (data.appointments || []).filter((a) => a.doctor_id === doc.id).length;
        const admCount = (data.admissions || []).filter((a) => a.attending_doctor_id === doc.id).length;
        return {
          label: doc.full_name,
          value: apptCount + admCount,
          sublabel: `${doc.specialization} · ${apptCount} appointments, ${admCount} admissions`,
          color: '#5350cc',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data.doctors, data.appointments, data.admissions]);

  const apptStatusSlices = useMemo(() => {
    const list = data.appointments || [];
    return [
      { label: 'Completed', value: list.filter((a) => a.status === 'completed').length, color: '#067647' },
      { label: 'Accepted', value: list.filter((a) => a.status === 'accepted').length, color: '#00b1ff' },
      { label: 'Pending', value: list.filter((a) => a.status === 'pending').length, color: '#D97706' },
      {
        label: 'Cancelled / Rejected',
        value: list.filter((a) => a.status === 'cancelled' || a.status === 'rejected').length,
        color: '#DC2626',
      },
    ];
  }, [data.appointments]);

  const deptRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const adm of data.admissions || []) {
      const dept = adm.department || 'General Medicine';
      map.set(dept, (map.get(dept) || 0) + Number(adm.total_billed_amount || 0));
    }
    return Array.from(map.entries())
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value, color: '#16165c' }))
      .sort((a, b) => b.value - a.value);
  }, [data.admissions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Reports & Analytics</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Patient volume, bed utilization, physician workload, and financial collections
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onDateRangeChange(days)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${
                  dateRange === days ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87]'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => exportHospitalCsv(data)}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
          >
            <Download className="w-3.5 h-3.5 text-[#5350cc]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Patient Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">Patient Analytics — Visits, Admissions & Discharges</h2>
          <ActivityLineChart data={activitySeries} height={240} />
        </div>
        <div className="lg:col-span-4 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">OPD vs IPD Breakdown</h2>
          <DonutChart
            centerLabel="Encounters"
            centerValue={ipdCount + opdCount}
            slices={[
              { label: 'Inpatient (IPD & ER)', value: ipdCount, color: '#16165c' },
              { label: 'Outpatient (OPD)', value: opdCount, color: '#00b1ff' },
            ]}
          />
        </div>
      </div>

      {/* Bed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">Bed Analytics — Ward Utilization</h2>
          <HorizontalBarList
            items={wardStats.map((w) => ({
              label: w.label,
              value: w.occupancyPct,
              sublabel: `${w.occupied} of ${w.total} beds occupied (${w.available} free)`,
              color: w.bedType === 'icu' ? '#16165c' : '#5350cc',
            }))}
            unit="%"
          />
        </div>
        <div className="lg:col-span-5 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">Bed Inventory Status</h2>
          <DonutChart
            centerLabel="Total Beds"
            centerValue={data.stats.total}
            slices={[
              { label: 'Available', value: data.stats.available, color: '#067647' },
              { label: 'Occupied', value: data.stats.occupied, color: '#5350cc' },
              { label: 'Reserved', value: data.stats.reserved, color: '#00b1ff' },
              { label: 'Maintenance', value: data.stats.maintenance, color: '#D97706' },
            ]}
          />
        </div>
      </div>

      {/* Doctor Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">Doctor Analytics — Clinical Workload</h2>
          <HorizontalBarList items={doctorWorkload} unit="cases" emptyText="No verified doctors assigned yet." />
        </div>
        <div className="lg:col-span-5 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">Appointment Completion Distribution</h2>
          <DonutChart
            centerLabel="Appointments"
            centerValue={(data.appointments || []).length}
            slices={apptStatusSlices}
          />
        </div>
      </div>

      {/* Financial Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">Financial Analytics — Billed vs Collected Trend</h2>
          <RevenueBarChart data={revenueSeries} />
        </div>
        <div className="lg:col-span-5 hosp-card space-y-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">Department-wise Billed Revenue</h2>
          <HorizontalBarList items={deptRevenue} prefix="INR " emptyText="No department billing recorded." />
          <p className="text-[11px] text-[#777D87] pt-2 border-t border-[#E5E7EB] font-mono-tabular">
            Pending invoices: {payments.filter((p) => p.status === 'pending').length} · Pending total INR{' '}
            {data.stats.pending_payments_total.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * NOTIFICATIONS TAB
 * ========================================================================== */
export function HospitalNotificationsTab({
  notifications,
  onMarkOneRead,
  onMarkAllRead,
}: {
  notifications: any[];
  onMarkOneRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const shown = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Notifications</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            Hospital operational alerts, credential verification notices, and emergency dispatch updates
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-[12px] font-medium rounded-md capitalize ${
                  filter === f ? 'bg-white text-[#16165c] shadow-xs' : 'text-[#777D87]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onMarkAllRead}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#5350cc]" />
            <span>Mark all read</span>
          </button>
        </div>
      </div>

      <div className="hosp-card p-0 overflow-hidden">
        {shown.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#777D87]">No notifications to display.</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {shown.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onMarkOneRead(n.id)}
                className={`w-full text-left px-5 py-4 hover:bg-[#F7F8FA] transition-colors flex items-start justify-between gap-4 ${
                  n.is_read ? 'opacity-65' : 'bg-[#5350cc]/[0.03]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#202124]">{n.title}</span>
                    <span className="text-[11px] uppercase text-[#5350cc] font-medium">{n.category}</span>
                  </div>
                  <p className="text-[13px] text-[#777D87]">{n.message}</p>
                </div>
                <span className="text-[11px] font-mono-tabular text-[#A0A5AE] whitespace-nowrap shrink-0">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * SETTINGS TAB
 * ========================================================================== */
export function HospitalSettingsTab({
  hospForm,
  setHospForm,
  onSave,
}: {
  hospForm: Record<string, any>;
  setHospForm: (next: Record<string, any>) => void;
  onSave: (e: FormEvent) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Hospital Settings</h1>
        <p className="text-[13px] text-[#777D87] mt-0.5">
          Facility identity, contact lines, departments, and clinical infrastructure
        </p>
      </div>

      <form onSubmit={onSave} className="hosp-card space-y-5 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Hospital Name</label>
            <input
              value={hospForm.name || ''}
              onChange={(e) => setHospForm({ ...hospForm, name: e.target.value })}
              className="hosp-input w-full px-3.5 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Registration No</label>
            <input
              disabled
              value={hospForm.registration_no || ''}
              className="hosp-input w-full px-3.5 py-2 text-[13px] font-mono-tabular bg-[#F7F8FA] text-[#777D87]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Branch Code</label>
            <input
              value={hospForm.branch_code || ''}
              onChange={(e) => setHospForm({ ...hospForm, branch_code: e.target.value })}
              className="hosp-input w-full px-3.5 py-2 text-[13px] font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Main Phone</label>
            <input
              value={hospForm.phone || ''}
              onChange={(e) => setHospForm({ ...hospForm, phone: e.target.value })}
              className="hosp-input w-full px-3.5 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Emergency Helpline</label>
            <input
              value={hospForm.emergency_phone || ''}
              onChange={(e) => setHospForm({ ...hospForm, emergency_phone: e.target.value })}
              className="hosp-input w-full px-3.5 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">City</label>
            <input
              value={hospForm.city || ''}
              onChange={(e) => setHospForm({ ...hospForm, city: e.target.value })}
              className="hosp-input w-full px-3.5 py-2 text-[13px]"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[12px] font-medium text-[#777D87] mb-1">Street Address</label>
            <input
              value={hospForm.address || ''}
              onChange={(e) => setHospForm({ ...hospForm, address: e.target.value })}
              className="hosp-input w-full px-3.5 py-2 text-[13px]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#777D87] mb-1">
            Clinical Departments (comma-separated)
          </label>
          <input
            value={hospForm.departmentsText || ''}
            onChange={(e) => setHospForm({ ...hospForm, departmentsText: e.target.value })}
            className="hosp-input w-full px-3.5 py-2 text-[13px]"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#777D87] mb-1">
            Facility Capabilities (comma-separated)
          </label>
          <input
            value={hospForm.facilitiesText || ''}
            onChange={(e) => setHospForm({ ...hospForm, facilitiesText: e.target.value })}
            className="hosp-input w-full px-3.5 py-2 text-[13px]"
          />
        </div>

        <div className="pt-2">
          <button type="submit" className="hosp-btn-primary px-5 py-2 text-[13px]">
            Save Hospital Settings
          </button>
        </div>
      </form>
    </div>
  );
}
