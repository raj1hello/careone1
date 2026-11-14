import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  Ambulance,
  BarChart3,
  BedDouble,
  Bell,
  Building2,
  CreditCard,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../services/api.ts';
import { PortalLayout, type NavItem } from '../components/PortalLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { HospitalOverviewTab, type QuickActionKey } from '../components/hospital/HospitalOverviewTab.tsx';
import {
  AdmissionsOpdTab,
  BedsWardsTab,
  DoctorsStaffTab,
  EmergencyOpsTab,
} from '../components/hospital/HospitalOperationsTabs.tsx';
import {
  BillingTab,
  FacilityTab,
  HospitalNotificationsTab,
  HospitalSettingsTab,
  ReportsAnalyticsTab,
} from '../components/hospital/HospitalEnterpriseTabs.tsx';
import type { HospitalDashboardData } from '../components/hospital/hospitalAnalytics.ts';

const HOSPITAL_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'beds', label: 'Beds & Wards', icon: BedDouble },
  { id: 'admissions', label: 'Admissions & OPD', icon: UserPlus },
  { id: 'staff', label: 'Doctors & Staff', icon: Users },
  { id: 'emergency', label: 'Emergency', icon: Ambulance },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'facility', label: 'Facility', icon: Building2 },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function HospitalPortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [data, setData] = useState<HospitalDashboardData | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hospForm, setHospForm] = useState<Record<string, any>>({});

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [transferAdm, setTransferAdm] = useState<any | null>(null);
  const [dischargingAdm, setDischargingAdm] = useState<any | null>(null);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);

  // Register patient form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBlood, setRegBlood] = useState('O+');
  const [regInsurance, setRegInsurance] = useState('');

  // Admit patient form
  const [admPatientId, setAdmPatientId] = useState('');
  const [admDoctorId, setAdmDoctorId] = useState('');
  const [admBedId, setAdmBedId] = useState('');
  const [admType, setAdmType] = useState<'opd' | 'inpatient' | 'emergency'>('inpatient');
  const [admDiagnosis, setAdmDiagnosis] = useState('');

  // Transfer bed form
  const [targetBedId, setTargetBedId] = useState('');

  // Discharge form
  const [disSummary, setDisSummary] = useState('');
  const [disTotalBill, setDisTotalBill] = useState('15000');
  const [disInsCovered, setDisInsCovered] = useState('10000');

  // Add Doctor form
  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docLicense, setDocLicense] = useState('');
  const [docSpec, setDocSpec] = useState('Cardiology');
  const [docQual, setDocQual] = useState('MD, DM');
  const [docExp, setDocExp] = useState('6');
  const [docFee, setDocFee] = useState('1000');

  // Create Bill form
  const [billAdmId, setBillAdmId] = useState('');
  const [billGross, setBillGross] = useState('2500');
  const [billIns, setBillIns] = useState('0');
  const [billStatus, setBillStatus] = useState<'pending' | 'paid'>('pending');
  const [billMethod, setBillMethod] = useState<'hospital_billing' | 'card' | 'upi' | 'insurance'>('hospital_billing');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dashRes, payRes, notifRes] = await Promise.all([
        api.get('/hospitals/dashboard'),
        api.get('/payments'),
        api.get('/notifications'),
      ]);
      setData(dashRes.data);
      setPayments(payRes.data.payments || dashRes.data.payments || []);
      setNotifications(notifRes.data.notifications || []);

      const h = dashRes.data.hospital;
      if (h) {
        let depts: string[] = [];
        let facs: string[] = [];
        try {
          depts = JSON.parse(h.departments_json || '[]');
          facs = JSON.parse(h.facilities_json || '[]');
        } catch {
          // ignore
        }
        setHospForm({
          ...h,
          departmentsText: depts.join(', '),
          facilitiesText: facs.join(', '),
        });
      }
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateBed = async (payload: {
    ward_name: string;
    bed_number: string;
    bed_type: 'general' | 'private' | 'icu' | 'emergency';
    daily_rate: number;
  }) => {
    setFeedback(null);
    try {
      await api.post('/hospitals/beds', payload);
      setFeedback({ type: 'ok', text: `Bed ${payload.bed_number.toUpperCase()} added` });
      await loadAll();
      return true;
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
      return false;
    }
  };

  const handleToggleBedStatus = async (bedId: number, status: 'available' | 'maintenance' | 'reserved') => {
    setFeedback(null);
    try {
      await api.patch(`/hospitals/beds/${bedId}`, { status });
      setFeedback({ type: 'ok', text: `Bed status updated to ${status}` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleOpenTransferForBed = (bed: any) => {
    if (!data) return;
    if (bed.status === 'occupied') {
      const adm = (data.admissions || []).find((a) => a.status === 'admitted' && a.bed_id === bed.id);
      if (adm) {
        setTargetBedId('');
        setTransferAdm(adm);
        return;
      }
    }
    setAdmBedId(String(bed.id));
    setAdmType('inpatient');
    setShowAdmitModal(true);
  };

  const handleRegisterPatient = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await api.post('/hospitals/patients/register', {
        full_name: regName,
        email: regEmail,
        phone: regPhone,
        blood_group: regBlood,
        insurance_provider: regInsurance,
      });
      setAdmPatientId(String(res.data.patient.id));
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegInsurance('');
      setShowRegisterModal(false);
      setFeedback({
        type: 'ok',
        text: `${res.data.existing ? 'Linked existing' : 'Registered'} patient ${res.data.patient.mrn}`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleAdmitPatient = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/hospitals/admissions', {
        patient_id: Number(admPatientId),
        attending_doctor_id: admDoctorId ? Number(admDoctorId) : null,
        bed_id: admBedId ? Number(admBedId) : null,
        admission_type: admType,
        diagnosis: admDiagnosis,
      });
      setAdmDiagnosis('');
      setAdmBedId('');
      setShowAdmitModal(false);
      setFeedback({ type: 'ok', text: 'Admission / OPD visit recorded' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleTransferBed = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferAdm || !targetBedId) return;
    setFeedback(null);
    try {
      await api.patch(`/hospitals/admissions/${transferAdm.id}/transfer-bed`, {
        bed_id: Number(targetBedId),
      });
      setTransferAdm(null);
      setTargetBedId('');
      setFeedback({ type: 'ok', text: 'Bed allocation updated' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleDischarge = async (e: FormEvent) => {
    e.preventDefault();
    if (!dischargingAdm) return;
    setFeedback(null);
    try {
      await api.post(`/hospitals/admissions/${dischargingAdm.id}/discharge`, {
        discharge_summary: disSummary,
        total_billed_amount: Number(disTotalBill),
        insurance_covered_amount: Number(disInsCovered),
      });
      setDischargingAdm(null);
      setDisSummary('');
      setFeedback({ type: 'ok', text: 'Patient discharged, bed released & invoice generated' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleVerifyDoctor = async (doctorId: number, status: 'verified' | 'rejected') => {
    setFeedback(null);
    try {
      await api.patch(`/hospitals/doctors/${doctorId}/verify`, { status });
      setFeedback({ type: 'ok', text: `Doctor ${status}` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleAddDoctor = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/hospitals/doctors', {
        full_name: docName,
        email: docEmail,
        phone: docPhone,
        license_no: docLicense,
        specialization: docSpec,
        qualification: docQual,
        experience_years: Number(docExp),
        consultation_fee: Number(docFee),
      });
      setDocName('');
      setDocEmail('');
      setDocPhone('');
      setDocLicense('');
      setShowAddDoctorModal(false);
      setFeedback({ type: 'ok', text: 'Doctor added and verified for hospital roster' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleAddStaff = async (payload: {
    full_name: string;
    role_title: string;
    department: string;
    staff_role: 'nurse' | 'coordinator' | 'billing' | 'admin' | 'technician';
    shift_schedule: string;
    phone: string;
  }) => {
    setFeedback(null);
    try {
      await api.post('/hospitals/staff', payload);
      setFeedback({ type: 'ok', text: `${payload.full_name} added to hospital staff` });
      await loadAll();
      return true;
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
      return false;
    }
  };

  const handleUpdateEmergency = async (
    id: number,
    payload: {
      status: 'dispatched' | 'en_route' | 'arrived' | 'admitted' | 'resolved';
      ambulance_unit?: string;
      eta_minutes?: number | null;
      assigned_doctor_id?: number | null;
      department?: string;
      bed_id?: number | null;
    }
  ) => {
    setFeedback(null);
    try {
      await api.patch(`/emergency/${id}/status`, payload);
      setFeedback({ type: 'ok', text: `Emergency #${id} updated to ${payload.status.replace('_', ' ')}` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleCreateBill = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/hospitals/bills', {
        admission_id: Number(billAdmId),
        gross_amount: Number(billGross),
        insurance_covered: Number(billIns),
        status: billStatus,
        payment_method: billMethod,
      });
      setShowCreateBillModal(false);
      setFeedback({ type: 'ok', text: 'Hospital invoice created' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleMarkBillPaid = async (billId: number) => {
    setFeedback(null);
    try {
      await api.patch(`/hospitals/bills/${billId}/status`, { status: 'paid' });
      setFeedback({ type: 'ok', text: 'Invoice marked as paid' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleAddResource = async (payload: {
    resource_type: 'ward' | 'room' | 'equipment' | 'laboratory' | 'operation_theatre' | 'facility';
    name: string;
    department: string;
    location: string;
    status: 'operational' | 'in_use' | 'maintenance';
    notes: string;
  }) => {
    setFeedback(null);
    try {
      await api.post('/hospitals/resources', payload);
      setFeedback({ type: 'ok', text: `${payload.name} registered under facility assets` });
      await loadAll();
      return true;
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
      return false;
    }
  };

  const handleUpdateResourceStatus = async (id: number, status: 'operational' | 'in_use' | 'maintenance') => {
    setFeedback(null);
    try {
      await api.patch(`/hospitals/resources/${id}`, { status });
      setFeedback({ type: 'ok', text: 'Facility unit status updated' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleMarkOneNotifRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch {
      // ignore
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // ignore
    }
  };

  const handleSaveHospitalProfile = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.put('/hospitals/profile', {
        name: hospForm.name,
        phone: hospForm.phone,
        emergency_phone: hospForm.emergency_phone,
        address: hospForm.address,
        city: hospForm.city,
        state: hospForm.state,
        branch_code: hospForm.branch_code,
        departments: String(hospForm.departmentsText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        facilities: String(hospForm.facilitiesText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setFeedback({ type: 'ok', text: 'Hospital settings saved' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleQuickAction = (action: QuickActionKey) => {
    switch (action) {
      case 'register_patient':
        setShowRegisterModal(true);
        break;
      case 'admit_patient':
        setAdmType('inpatient');
        setShowAdmitModal(true);
        break;
      case 'allocate_bed':
        setActiveTab('beds');
        break;
      case 'add_doctor':
        setShowAddDoctorModal(true);
        break;
      case 'create_bill':
        if (data?.admissions?.length && !billAdmId) {
          setBillAdmId(String(data.admissions[0].id));
        }
        setShowCreateBillModal(true);
        break;
      case 'view_appointments':
        setShowAppointmentsModal(true);
        break;
    }
  };

  const todayHeaderDate = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <PortalLayout
      portalTitle="Hospital Console"
      portalSubtitle={data?.hospital ? data.hospital.name : ''}
      navItems={HOSPITAL_NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      theme="hospital"
      collapsible
      headerMeta={
        <span className="hidden lg:inline-flex items-center text-[12px] font-mono-tabular text-[#777D87] pr-1">
          {todayHeaderDate}
        </span>
      }
    >
      {feedback && (
        <div
          className={`mb-5 px-4 py-3 rounded-lg border text-[13px] font-medium flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'border-[#A7F3D0] bg-[#ECFDF3] text-[#067647]'
              : 'border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C]'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[12px] underline ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-5">
          <div className="h-10 w-56 bg-[#E5E7EB]/60 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 hosp-card-compact animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 h-64 hosp-card animate-pulse" />
            <div className="lg:col-span-4 h-64 hosp-card animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && data && (
            <HospitalOverviewTab
              data={data}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onNavigateTab={setActiveTab}
              onQuickAction={handleQuickAction}
            />
          )}

          {activeTab === 'beds' && data && (
            <BedsWardsTab
              data={data}
              onCreateBed={handleCreateBed}
              onToggleBedStatus={handleToggleBedStatus}
              onOpenTransferForBed={handleOpenTransferForBed}
            />
          )}

          {activeTab === 'admissions' && data && (
            <AdmissionsOpdTab
              data={data}
              onOpenRegisterModal={() => setShowRegisterModal(true)}
              onOpenAdmitModal={() => setShowAdmitModal(true)}
              onOpenDischargeModal={(adm) => {
                setDisSummary('');
                setDischargingAdm(adm);
              }}
              onOpenTransferModal={(adm) => {
                setTargetBedId('');
                setTransferAdm(adm);
              }}
            />
          )}

          {activeTab === 'staff' && data && (
            <DoctorsStaffTab
              data={data}
              onVerifyDoctor={handleVerifyDoctor}
              onOpenAddDoctorModal={() => setShowAddDoctorModal(true)}
              onAddStaff={handleAddStaff}
            />
          )}

          {activeTab === 'emergency' && data && (
            <EmergencyOpsTab data={data} onUpdateEmergency={handleUpdateEmergency} />
          )}

          {activeTab === 'billing' && data && (
            <BillingTab
              data={data}
              payments={payments}
              onOpenCreateBill={() => {
                if (data.admissions?.length && !billAdmId) {
                  setBillAdmId(String(data.admissions[0].id));
                }
                setShowCreateBillModal(true);
              }}
              onMarkBillPaid={handleMarkBillPaid}
            />
          )}

          {activeTab === 'facility' && data && (
            <FacilityTab
              data={data}
              onAddResource={handleAddResource}
              onUpdateResourceStatus={handleUpdateResourceStatus}
            />
          )}

          {activeTab === 'reports' && data && (
            <ReportsAnalyticsTab
              data={data}
              payments={payments}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          )}

          {activeTab === 'notifications' && (
            <HospitalNotificationsTab
              notifications={notifications}
              onMarkOneRead={handleMarkOneNotifRead}
              onMarkAllRead={handleMarkAllNotifsRead}
            />
          )}

          {activeTab === 'settings' && (
            <HospitalSettingsTab
              hospForm={hospForm}
              setHospForm={setHospForm}
              onSave={handleSaveHospitalProfile}
            />
          )}
        </>
      )}

      {/* Modal: Register / Link Patient */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRegisterPatient} className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[#202124]">Register or Link Patient</h3>
              <button type="button" onClick={() => setShowRegisterModal(false)} className="text-[#777D87] hover:text-[#202124]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Full Name</label>
                <input
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Patient full name"
                  className="hosp-input w-full px-3 py-2 text-[13px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="hosp-input w-full px-3 py-2 text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Phone</label>
                  <input
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91..."
                    className="hosp-input w-full px-3 py-2 text-[13px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Blood Group</label>
                  <input
                    value={regBlood}
                    onChange={(e) => setRegBlood(e.target.value)}
                    className="hosp-input w-full px-3 py-2 text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Insurance Provider</label>
                  <input
                    value={regInsurance}
                    onChange={(e) => setRegInsurance(e.target.value)}
                    placeholder="Optional"
                    className="hosp-input w-full px-3 py-2 text-[13px]"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setShowRegisterModal(false)} className="hosp-btn-secondary px-4 py-2 text-[13px]">
                Cancel
              </button>
              <button type="submit" className="hosp-btn-primary px-4 py-2 text-[13px]">
                Register / Link
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Admit & Allocate Bed */}
      {showAdmitModal && data && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAdmitPatient} className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[#202124]">New Admission / OPD Encounter</h3>
              <button type="button" onClick={() => setShowAdmitModal(false)} className="text-[#777D87] hover:text-[#202124]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Patient</label>
                <select
                  required
                  value={admPatientId}
                  onChange={(e) => setAdmPatientId(e.target.value)}
                  className="hosp-input w-full px-3 py-2 text-[13px]"
                >
                  <option value="">Select patient...</option>
                  {data.patients.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Attending Doctor</label>
                <select
                  value={admDoctorId}
                  onChange={(e) => setAdmDoctorId(e.target.value)}
                  className="hosp-input w-full px-3 py-2 text-[13px]"
                >
                  <option value="">Duty Attending</option>
                  {data.doctors
                    .filter((d: any) => d.verification_status === 'verified')
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.specialization})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Admission Type</label>
                <select
                  value={admType}
                  onChange={(e) => setAdmType(e.target.value as any)}
                  className="hosp-input w-full px-3 py-2 text-[13px]"
                >
                  <option value="inpatient">Inpatient (IPD)</option>
                  <option value="opd">Outpatient (OPD)</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Allocate Bed</label>
                <select
                  value={admBedId}
                  onChange={(e) => setAdmBedId(e.target.value)}
                  className="hosp-input w-full px-3 py-2 text-[13px]"
                >
                  <option value="">No Bed (OPD / Pending)</option>
                  {data.beds
                    .filter((b: any) => b.status === 'available' || b.status === 'reserved')
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.bed_number} · {b.ward_name} ({b.bed_type.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#777D87] mb-1">Primary Diagnosis / Reason</label>
              <input
                required
                value={admDiagnosis}
                onChange={(e) => setAdmDiagnosis(e.target.value)}
                placeholder="Clinical reason or diagnosis..."
                className="hosp-input w-full px-3 py-2 text-[13px]"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setShowAdmitModal(false)} className="hosp-btn-secondary px-4 py-2 text-[13px]">
                Cancel
              </button>
              <button type="submit" className="hosp-btn-primary px-4 py-2 text-[13px]">
                Confirm Admission
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Transfer / Assign Bed */}
      {transferAdm && data && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleTransferBed} className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[#202124]">
                {transferAdm.bed_number ? 'Transfer Bed' : 'Assign Bed'} — {transferAdm.patient_name}
              </h3>
              <button type="button" onClick={() => setTransferAdm(null)} className="text-[#777D87] hover:text-[#202124]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[12px] text-[#777D87]">
              Current bed: <span className="font-mono-tabular font-semibold text-[#202124]">{transferAdm.bed_number || 'Unassigned (OPD)'}</span>
            </p>
            <div>
              <label className="block text-[12px] font-medium text-[#777D87] mb-1">Target Available Bed</label>
              <select
                required
                value={targetBedId}
                onChange={(e) => setTargetBedId(e.target.value)}
                className="hosp-input w-full px-3 py-2 text-[13px]"
              >
                <option value="">Select destination bed...</option>
                {data.beds
                  .filter((b: any) => (b.status === 'available' || b.status === 'reserved') && b.id !== transferAdm.bed_id)
                  .map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.bed_number} · {b.ward_name} ({b.bed_type.toUpperCase()})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setTransferAdm(null)} className="hosp-btn-secondary px-4 py-2 text-[13px]">
                Cancel
              </button>
              <button type="submit" className="hosp-btn-primary px-4 py-2 text-[13px]">
                Confirm Bed Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Discharge & Bill */}
      {dischargingAdm && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleDischarge} className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[#202124]">
                Discharge {dischargingAdm.patient_name}
              </h3>
              <button type="button" onClick={() => setDischargingAdm(null)} className="text-[#777D87] hover:text-[#202124]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#777D87] mb-1">Clinical Discharge Summary</label>
              <textarea
                required
                rows={4}
                value={disSummary}
                onChange={(e) => setDisSummary(e.target.value)}
                placeholder="Condition at discharge, medications, follow-up instructions..."
                className="hosp-input w-full px-3 py-2 text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Gross Bill (INR)</label>
                <input
                  type="number"
                  required
                  value={disTotalBill}
                  onChange={(e) => setDisTotalBill(e.target.value)}
                  className="hosp-input w-full px-3 py-2 text-[13px] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Insurance Covered (INR)</label>
                <input
                  type="number"
                  required
                  value={disInsCovered}
                  onChange={(e) => setDisInsCovered(e.target.value)}
                  className="hosp-input w-full px-3 py-2 text-[13px] font-mono-tabular"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setDischargingAdm(null)} className="hosp-btn-secondary px-4 py-2 text-[13px]">
                Cancel
              </button>
              <button type="submit" className="hosp-btn-primary px-4 py-2 text-[13px]">
                Finalize Discharge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Affiliated Doctor */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAddDoctor} className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[#202124]">Onboard Affiliated Doctor</h3>
              <button type="button" onClick={() => setShowAddDoctorModal(false)} className="text-[#777D87] hover:text-[#202124]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Dr. Full Name"
                className="hosp-input px-3 py-2 text-[13px]"
              />
              <input
                required
                type="email"
                value={docEmail}
                onChange={(e) => setDocEmail(e.target.value)}
                placeholder="doctor@hospital.health"
                className="hosp-input px-3 py-2 text-[13px]"
              />
              <input
                value={docPhone}
                onChange={(e) => setDocPhone(e.target.value)}
                placeholder="Contact Phone"
                className="hosp-input px-3 py-2 text-[13px]"
              />
              <input
                required
                value={docLicense}
                onChange={(e) => setDocLicense(e.target.value)}
                placeholder="Medical License No"
                className="hosp-input px-3 py-2 text-[13px] font-mono-tabular"
              />
              <input
                required
                value={docSpec}
                onChange={(e) => setDocSpec(e.target.value)}
                placeholder="Department / Specialization"
                className="hosp-input px-3 py-2 text-[13px]"
              />
              <input
                required
                value={docQual}
                onChange={(e) => setDocQual(e.target.value)}
                placeholder="Qualification (e.g. MD, DM)"
                className="hosp-input px-3 py-2 text-[13px]"
              />
              <input
                type="number"
                required
                value={docExp}
                onChange={(e) => setDocExp(e.target.value)}
                placeholder="Years of Experience"
                className="hosp-input px-3 py-2 text-[13px] font-mono-tabular"
              />
              <input
                type="number"
                required
                value={docFee}
                onChange={(e) => setDocFee(e.target.value)}
                placeholder="Consultation Fee (INR)"
                className="hosp-input px-3 py-2 text-[13px] font-mono-tabular"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setShowAddDoctorModal(false)} className="hosp-btn-secondary px-4 py-2 text-[13px]">
                Cancel
              </button>
              <button type="submit" className="hosp-btn-primary px-4 py-2 text-[13px]">
                Add & Verify Doctor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create Bill */}
      {showCreateBillModal && data && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateBill} className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[#202124]">Create Hospital Bill</h3>
              <button type="button" onClick={() => setShowCreateBillModal(false)} className="text-[#777D87] hover:text-[#202124]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#777D87] mb-1">Admission / Encounter</label>
                <select
                  required
                  value={billAdmId}
                  onChange={(e) => setBillAdmId(e.target.value)}
                  className="hosp-input w-full px-3 py-2 text-[13px]"
                >
                  <option value="">Select encounter...</option>
                  {(data.admissions || []).map((adm: any) => (
                    <option key={adm.id} value={adm.id}>
                      {adm.patient_name} ({adm.mrn}) · {adm.admission_type.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Gross Amount (INR)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={billGross}
                    onChange={(e) => setBillGross(e.target.value)}
                    className="hosp-input w-full px-3 py-2 text-[13px] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Insurance Covered</label>
                  <input
                    type="number"
                    min={0}
                    value={billIns}
                    onChange={(e) => setBillIns(e.target.value)}
                    className="hosp-input w-full px-3 py-2 text-[13px] font-mono-tabular"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Payment Status</label>
                  <select
                    value={billStatus}
                    onChange={(e) => setBillStatus(e.target.value as any)}
                    className="hosp-input w-full px-3 py-2 text-[13px]"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#777D87] mb-1">Method</label>
                  <select
                    value={billMethod}
                    onChange={(e) => setBillMethod(e.target.value as any)}
                    className="hosp-input w-full px-3 py-2 text-[13px]"
                  >
                    <option value="hospital_billing">Hospital Counter</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="insurance">Insurance Claim</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setShowCreateBillModal(false)} className="hosp-btn-secondary px-4 py-2 text-[13px]">
                Cancel
              </button>
              <button type="submit" className="hosp-btn-primary px-4 py-2 text-[13px]">
                Generate Invoice
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Hospital Appointments Schedule */}
      {showAppointmentsModal && data && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-semibold text-[#202124]">Hospital Appointments Schedule</h3>
                <p className="text-[12px] text-[#777D87]">
                  {(data.appointments || []).length} scheduled consultation{(data.appointments || []).length === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" onClick={() => setShowAppointmentsModal(false)} className="text-[#777D87] hover:text-[#202124]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {(data.appointments || []).length === 0 ? (
                <p className="py-12 text-center text-[13px] text-[#777D87]">No appointments scheduled.</p>
              ) : (
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#F7F8FA] text-[12px] text-[#777D87] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date & Time</th>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Doctor</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {(data.appointments || []).map((a: any) => (
                      <tr key={a.id} className="hover:bg-[#F7F8FA]">
                        <td className="px-5 py-3 font-mono-tabular text-[#202124] whitespace-nowrap">
                          {a.appointment_date} · {a.time_slot}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#202124]">{a.patient_name}</p>
                          <p className="text-[11px] font-mono-tabular text-[#777D87]">{a.mrn}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[#202124]">{a.doctor_name}</p>
                          <p className="text-[11px] text-[#777D87]">{a.specialization}</p>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={a.status} variant="hospital" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-3 border-t border-[#E5E7EB] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowAppointmentsModal(false);
                  setActiveTab('admissions');
                }}
                className="hosp-btn-secondary px-3.5 py-1.5 text-[12px]"
              >
                Open Admissions & OPD
              </button>
              <button
                type="button"
                onClick={() => setShowAppointmentsModal(false)}
                className="hosp-btn-primary px-4 py-1.5 text-[12px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
