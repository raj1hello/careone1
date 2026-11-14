import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  CalendarCheck,
  FilePlus2,
  FolderHeart,
  Plus,
  Trash2,
  UserCog,
  Video,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../services/api.ts';
import { PortalLayout, type NavItem } from '../components/PortalLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { VidDocRoom } from '../components/VidDocRoom.tsx';

const DOCTOR_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
  { id: 'consultations', label: 'VidDoc & History', icon: Video },
  { id: 'prescriptions', label: 'Prescriptions', icon: FilePlus2 },
  { id: 'patients', label: 'Patient Records', icon: FolderHeart },
  { id: 'profile', label: 'Schedule & Profile', icon: UserCog },
];

export function DoctorPortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [data, setData] = useState<any>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientHistory, setPatientHistory] = useState<any | null>(null);

  const [rxPatientId, setRxPatientId] = useState<string>('');
  const [rxConsultId, setRxConsultId] = useState<string>('');
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [rxNotes, setRxNotes] = useState('');
  const [rxItems, setRxItems] = useState([
    { medicine_name: '', generic_name: '', dosage: '1 tablet', frequency: 'Once daily', duration_days: 14, instructions: 'After food' },
  ]);

  const [profileForm, setProfileForm] = useState<Record<string, any>>({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dashRes, consRes, hospRes] = await Promise.all([
        api.get('/doctors/dashboard'),
        api.get('/consultations'),
        api.get('/hospitals'),
      ]);
      setData(dashRes.data);
      setConsultations(consRes.data.consultations || []);
      setHospitals(hospRes.data.hospitals || []);

      const doc = dashRes.data.doctor;
      if (doc) {
        let days: string[] = [];
        try {
          days = JSON.parse(doc.available_days_json || '[]');
        } catch {
          days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        }
        setProfileForm({
          ...doc,
          available_days: days,
          is_available_for_video: Boolean(doc.is_available_for_video),
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

  const handleAppointmentStatus = async (id: number, status: 'accepted' | 'rejected' | 'completed') => {
    setFeedback(null);
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      setFeedback({ type: 'ok', text: `Appointment #${id} ${status}` });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleOpenRoom = async (roomCode: string) => {
    try {
      const res = await api.get(`/consultations/${roomCode}`);
      setActiveRoom(res.data.consultation);
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleLoadPatientHistory = async (patientId: number) => {
    setSelectedPatientId(patientId);
    setPatientHistory(null);
    try {
      const res = await api.get(`/doctors/patients/${patientId}/history`);
      setPatientHistory(res.data);
      setActiveTab('patients');
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleCreateRx = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/prescriptions', {
        patient_id: Number(rxPatientId),
        consultation_id: rxConsultId ? Number(rxConsultId) : null,
        diagnosis: rxDiagnosis,
        notes: rxNotes,
        items: rxItems,
      });
      setFeedback({ type: 'ok', text: 'Prescription issued' });
      setRxDiagnosis('');
      setRxNotes('');
      setRxItems([
        { medicine_name: '', generic_name: '', dosage: '1 tablet', frequency: 'Once daily', duration_days: 14, instructions: 'After food' },
      ]);
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.put('/doctors/profile', {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
        hospital_id: profileForm.hospital_id ? Number(profileForm.hospital_id) : null,
        specialization: profileForm.specialization,
        qualification: profileForm.qualification,
        experience_years: Number(profileForm.experience_years),
        consultation_fee: Number(profileForm.consultation_fee),
        bio: profileForm.bio,
        available_days: profileForm.available_days,
        slot_start_time: profileForm.slot_start_time,
        slot_end_time: profileForm.slot_end_time,
        is_available_for_video: Boolean(profileForm.is_available_for_video),
      });
      setFeedback({ type: 'ok', text: 'Profile updated' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const uniquePatients = Array.from(
    new Map(
      (data?.appointments || []).map((a: any) => [
        a.patient_id,
        { id: a.patient_id, name: a.patient_name, mrn: a.mrn },
      ])
    ).values()
  ) as Array<{ id: number; name: string; mrn: string }>;

  return (
    <PortalLayout
      portalTitle="Doctor Portal"
      portalSubtitle={data?.doctor ? `${data.doctor.specialization}` : ''}
      navItems={DOCTOR_NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {feedback && (
        <div
          className={`mb-5 px-4 py-3 rounded-xl border text-[13px] font-medium flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-[#15803d]'
              : 'border-red-200 bg-red-50 text-[#dc2626]'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-[12px] underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 glass-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {data?.doctor?.verification_status !== 'verified' && (
            <div className="mb-5 glass-card py-3.5 text-[13px] text-[#6e6e73]">
              Verification status:{' '}
              <span className="font-semibold uppercase text-[#0071e3]">{data?.doctor?.verification_status}</span>
            </div>
          )}

          {activeTab === 'overview' && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Pending Requests</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold font-mono-tabular text-[#0071e3]">
                    {data.stats.pending_requests}
                  </p>
                </div>
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Confirmed Visits</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold font-mono-tabular text-[#15803d]">
                    {data.stats.todays_confirmed}
                  </p>
                </div>
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Completed</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold font-mono-tabular text-[#1d1d1f]">
                    {data.stats.completed_consultations}
                  </p>
                </div>
                <div className="glass-card">
                  <p className="text-[12px] font-medium text-[#6e6e73]">Prescriptions</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold font-mono-tabular text-[#1d1d1f]">
                    {data.stats.total_prescriptions}
                  </p>
                </div>
              </div>

              <div className="glass-card">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f] mb-3">Appointment Queue</h2>
                <div className="divide-y divide-black/[0.06]">
                  {(data.appointments || []).slice(0, 6).map((a: any) => (
                    <div key={a.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-[#1d1d1f]">
                          {a.patient_name}{' '}
                          <span className="text-[12px] font-mono-tabular text-[#6e6e73]">({a.mrn})</span>
                        </p>
                        <p className="text-[12px] text-[#6e6e73]">
                          {a.appointment_date} {a.time_slot} · {a.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        {a.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAppointmentStatus(a.id, 'accepted')}
                              className="mac-btn-primary px-3.5 py-1.5 text-[12px]"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAppointmentStatus(a.id, 'rejected')}
                              className="mac-btn-secondary px-3 py-1.5 text-[12px] text-[#dc2626]"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {a.status === 'accepted' && a.room_code && (
                          <button
                            type="button"
                            onClick={() => handleOpenRoom(a.room_code)}
                            className="mac-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>VidDoc</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appointments' && data && (
            <div className="glass-card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-black/[0.06]">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Appointments</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-black/[0.025] text-[12px] text-[#6e6e73]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Patient</th>
                      <th className="px-6 py-3 font-medium">Slot</th>
                      <th className="px-6 py-3 font-medium">Mode</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06]">
                    {data.appointments.map((a: any) => (
                      <tr key={a.id} className="hover:bg-black/[0.02]">
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-[#1d1d1f]">{a.patient_name}</p>
                          <p className="text-[12px] text-[#6e6e73] font-mono-tabular">
                            {a.mrn} · {a.allergies}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 font-mono-tabular text-[#1d1d1f]">
                          {a.appointment_date} {a.time_slot}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={a.mode} />
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleLoadPatientHistory(a.patient_id)}
                            className="mac-btn-secondary px-3 py-1.5 text-[12px]"
                          >
                            History
                          </button>
                          {(a.status === 'pending' || a.status === 'rescheduled') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAppointmentStatus(a.id, 'accepted')}
                                className="mac-btn-primary px-3.5 py-1.5 text-[12px]"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAppointmentStatus(a.id, 'rejected')}
                                className="mac-btn-secondary px-3 py-1.5 text-[12px] text-[#dc2626]"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {a.status === 'accepted' && (
                            <>
                              {a.room_code && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRoom(a.room_code)}
                                  className="mac-btn-primary px-3.5 py-1.5 text-[12px]"
                                >
                                  VidDoc
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleAppointmentStatus(a.id, 'completed')}
                                className="mac-btn-secondary px-3 py-1.5 text-[12px] text-[#15803d]"
                              >
                                Complete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'consultations' && (
            <div className="space-y-4">
              <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Consultations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {consultations.map((c) => (
                  <div key={c.id} className="glass-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[15px] font-semibold text-[#1d1d1f]">
                          {c.patient_name}{' '}
                          <span className="font-mono-tabular text-[12px] text-[#6e6e73]">({c.mrn})</span>
                        </p>
                        <p className="text-[12px] text-[#6e6e73] font-mono-tabular">
                          {c.room_code} · {c.appointment_date} {c.time_slot}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-[13px] text-[#6e6e73]">{c.clinical_notes || 'No notes recorded'}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-black/[0.06]">
                      <button
                        type="button"
                        onClick={() => {
                          setRxPatientId(String(c.patient_id));
                          setRxConsultId(String(c.id));
                          setActiveTab('prescriptions');
                        }}
                        className="text-[13px] font-medium text-[#0071e3] hover:underline"
                      >
                        Write Prescription
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenRoom(c.room_code)}
                        className="mac-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Room</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form onSubmit={handleCreateRx} className="lg:col-span-7 glass-card space-y-4">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">New Prescription</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Patient</label>
                    <select
                      required
                      value={rxPatientId}
                      onChange={(e) => setRxPatientId(e.target.value)}
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    >
                      <option value="">Select patient...</option>
                      {uniquePatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.mrn})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Diagnosis</label>
                    <input
                      required
                      value={rxDiagnosis}
                      onChange={(e) => setRxDiagnosis(e.target.value)}
                      placeholder="Diagnosis"
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#1d1d1f]">Medications</span>
                    <button
                      type="button"
                      onClick={() =>
                        setRxItems((prev) => [
                          ...prev,
                          { medicine_name: '', generic_name: '', dosage: '1 tablet', frequency: 'Twice daily', duration_days: 7, instructions: 'After meals' },
                        ])
                      }
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0071e3] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  {rxItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        required
                        placeholder="Medicine"
                        value={item.medicine_name}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx].medicine_name = e.target.value;
                          setRxItems(next);
                        }}
                        className="col-span-5 px-2.5 py-2 glass-input text-[12px]"
                      />
                      <input
                        required
                        placeholder="Dosage"
                        value={item.dosage}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx].dosage = e.target.value;
                          setRxItems(next);
                        }}
                        className="col-span-3 px-2.5 py-2 glass-input text-[12px]"
                      />
                      <input
                        required
                        placeholder="Frequency"
                        value={item.frequency}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx].frequency = e.target.value;
                          setRxItems(next);
                        }}
                        className="col-span-2 px-2.5 py-2 glass-input text-[12px]"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.duration_days}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx].duration_days = Number(e.target.value);
                          setRxItems(next);
                        }}
                        className="col-span-1 px-1.5 py-2 glass-input text-[12px] font-mono-tabular"
                      />
                      <button
                        type="button"
                        disabled={rxItems.length === 1}
                        onClick={() => setRxItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 text-[#dc2626] disabled:opacity-30 flex justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                  placeholder="Instructions..."
                  className="w-full px-3 py-2 glass-input text-[13px]"
                />

                <button type="submit" className="mac-btn-primary px-5 py-2.5 text-[13px]">
                  Issue Prescription
                </button>
              </form>

              <div className="lg:col-span-5 glass-card space-y-3">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Recent Prescriptions</h3>
                <div className="divide-y divide-black/[0.06]">
                  {(data?.prescriptions || []).map((rx: any) => (
                    <div key={rx.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-[#1d1d1f]">
                          Rx #{rx.id} · {rx.patient_name}
                        </p>
                        <StatusBadge status={rx.status} />
                      </div>
                      <p className="text-[12px] font-medium text-[#0071e3]">{rx.diagnosis}</p>
                      <p className="text-[12px] text-[#6e6e73]">
                        {(rx.items || []).map((i: any) => `${i.medicine_name} (${i.dosage})`).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 glass-card space-y-3">
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Patients</h2>
                <div className="divide-y divide-black/[0.06]">
                  {uniquePatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleLoadPatientHistory(p.id)}
                      className={`w-full text-left py-3 px-2.5 rounded-lg transition-colors ${
                        selectedPatientId === p.id ? 'bg-[#0071e3]/10' : 'hover:bg-black/[0.03]'
                      }`}
                    >
                      <p className="text-[14px] font-semibold text-[#1d1d1f]">{p.name}</p>
                      <p className="text-[12px] font-mono-tabular text-[#6e6e73]">{p.mrn}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8 glass-card">
                {!patientHistory ? (
                  <p className="text-[14px] text-[#6e6e73]">Select a patient</p>
                ) : (
                  <div className="space-y-4">
                    <div className="border-b border-black/[0.06] pb-3.5">
                      <h3 className="text-[20px] font-semibold text-[#1d1d1f]">{patientHistory.patient.full_name}</h3>
                      <p className="text-[12px] font-mono-tabular text-[#6e6e73] mt-1">
                        {patientHistory.patient.mrn} · {patientHistory.patient.blood_group || 'N/A'} · Allergies:{' '}
                        {patientHistory.patient.allergies}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-2">Records</h4>
                      <div className="divide-y divide-black/[0.06]">
                        {patientHistory.records.map((r: any) => (
                          <div key={r.id} className="py-3 text-[13px]">
                            <p className="font-semibold text-[#1d1d1f]">
                              {r.title} <span className="font-mono-tabular text-[#6e6e73]">({r.record_date})</span>
                            </p>
                            <p className="text-[#6e6e73] mt-0.5">{r.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="glass-card space-y-5">
              <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Profile & Schedule</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Full Name</label>
                  <input
                    value={profileForm.full_name || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Specialization</label>
                  <input
                    value={profileForm.specialization || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })}
                    className="w-full px-3.5 py-2 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Hospital</label>
                  <select
                    value={profileForm.hospital_id || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, hospital_id: e.target.value })}
                    className="w-full px-3.5 py-2 glass-input text-[14px]"
                  >
                    <option value="">Independent</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Fee (INR)</label>
                  <input
                    type="number"
                    value={profileForm.consultation_fee || 0}
                    onChange={(e) => setProfileForm({ ...profileForm, consultation_fee: e.target.value })}
                    className="w-full px-3.5 py-2 glass-input text-[14px] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={profileForm.slot_start_time || '09:00'}
                    onChange={(e) => setProfileForm({ ...profileForm, slot_start_time: e.target.value })}
                    className="w-full px-3.5 py-2 glass-input text-[14px] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">End Time</label>
                  <input
                    type="time"
                    value={profileForm.slot_end_time || '17:00'}
                    onChange={(e) => setProfileForm({ ...profileForm, slot_end_time: e.target.value })}
                    className="w-full px-3.5 py-2 glass-input text-[14px] font-mono-tabular"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Bio</label>
                  <textarea
                    rows={3}
                    value={profileForm.bio || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="w-full px-3.5 py-2 glass-input text-[14px]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-[#1d1d1f]">
                <input
                  type="checkbox"
                  checked={Boolean(profileForm.is_available_for_video)}
                  onChange={(e) => setProfileForm({ ...profileForm, is_available_for_video: e.target.checked })}
                  className="accent-[#0071e3]"
                />
                <span>Available for VidDoc</span>
              </label>
              <button type="submit" className="mac-btn-primary px-5 py-2.5 text-[13px]">
                Save Profile
              </button>
            </form>
          )}
        </>
      )}

      {activeRoom && (
        <VidDocRoom
          consultation={activeRoom}
          userRole="doctor"
          onClose={() => setActiveRoom(null)}
          onSaved={loadAll}
        />
      )}
    </PortalLayout>
  );
}
