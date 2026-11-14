import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlarmClock,
  Ambulance,
  Bell,
  Building2,
  CalendarClock,
  CheckCheck,
  CreditCard,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  Pill,
  Search,
  Sparkles,
  Stethoscope,
  UserCog,
  Video,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';
import { PortalLayout, type NavItem } from '../components/PortalLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { VidDocRoom } from '../components/VidDocRoom.tsx';
import { AIHealthAssistant, type NavigateOptions } from '../components/AIHealthAssistant.tsx';

const PATIENT_NAV: NavItem[] = [
  { id: 'assistant', label: 'AI Health Assistant', icon: Sparkles },
  { id: 'doctors', label: 'Find Doctors', icon: Stethoscope },
  { id: 'appointments', label: 'My Appointments', icon: CalendarClock },
  { id: 'viddoc', label: 'VidDoc Consultation', icon: Video },
  { id: 'emergency', label: 'Emergency Assistance', icon: Ambulance },
  { id: 'records', label: 'Medical Records', icon: FileSpreadsheet },
  { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
  { id: 'pharmacy', label: 'Medicines & Pharmacy', icon: Pill },
  { id: 'reminders', label: 'Medicine Reminders', icon: AlarmClock },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'My Profile', icon: UserCog },
];

export function PatientPortal() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('assistant');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [dashboard, setDashboard] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [allSpecializations, setAllSpecializations] = useState<string[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [gatewayMode, setGatewayMode] = useState('razorpay_sandbox');
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [aidPrograms, setAidPrograms] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);

  const [docSearch, setDocSearch] = useState('');
  const [docSpec, setDocSpec] = useState('all');
  const [docHosp, setDocHosp] = useState('all');
  const [docVideoOnly, setDocVideoOnly] = useState(false);

  const hospitalsSectionRef = useRef<HTMLDivElement | null>(null);

  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);
  const [bookDate, setBookDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [bookSlot, setBookSlot] = useState('10:00');
  const [bookMode, setBookMode] = useState<'in_person' | 'video'>('video');
  const [bookReason, setBookReason] = useState('');

  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedSlot, setReschedSlot] = useState('');

  const [remName, setRemName] = useState('');
  const [remDosage, setRemDosage] = useState('');
  const [remTime, setRemTime] = useState('08:00');

  const [recTitle, setRecTitle] = useState('');
  const [recType, setRecType] = useState<'lab_report' | 'imaging' | 'discharge_summary' | 'clinical_note' | 'vaccination'>('lab_report');
  const [recSummary, setRecSummary] = useState('');
  const [recFileName, setRecFileName] = useState('');
  const [recFileMime, setRecFileMime] = useState('');
  const [recFileSize, setRecFileSize] = useState(0);
  const [recDataUrl, setRecDataUrl] = useState('');

  const [medSearch, setMedSearch] = useState('');
  const [cart, setCart] = useState<Array<{ medicine: any; quantity: number }>>([]);
  const [selectedRxId, setSelectedRxId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [emgType, setEmgType] = useState('Acute Cardiac / Chest Pain');
  const [emgSeverity, setEmgSeverity] = useState<'critical' | 'high' | 'moderate'>('high');
  const [emgLocation, setEmgLocation] = useState('');
  const [emgPhone, setEmgPhone] = useState('');
  const [emgDesc, setEmgDesc] = useState('');

  const [profileForm, setProfileForm] = useState<Record<string, any>>({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        dashRes,
        hospRes,
        apptRes,
        rxRes,
        recRes,
        catRes,
        ordRes,
        payRes,
        emgRes,
        aidRes,
        notifRes,
      ] = await Promise.all([
        api.get('/patient/dashboard'),
        api.get('/hospitals'),
        api.get('/appointments'),
        api.get('/prescriptions'),
        api.get('/records'),
        api.get('/pharmacies/catalog'),
        api.get('/orders'),
        api.get('/payments'),
        api.get('/emergency'),
        api.get('/patient/financial-assistance'),
        api.get('/notifications'),
      ]);

      setDashboard(dashRes.data);
      setHospitals(hospRes.data.hospitals || []);
      setAppointments(apptRes.data.appointments || []);
      setPrescriptions(rxRes.data.prescriptions || []);
      setRecords(recRes.data.records || []);
      setCatalog(catRes.data.medicines || []);
      setOrders(ordRes.data.orders || []);
      setPayments(payRes.data.payments || []);
      setGatewayMode(payRes.data.gateway_mode || 'razorpay_sandbox');
      setEmergencies(emgRes.data.requests || []);
      setAidPrograms(aidRes.data.programs || []);
      setNotifications(notifRes.data.notifications || []);

      const p = dashRes.data.patient;
      if (p) {
        setProfileForm(p);
        setDeliveryAddress((prev) => prev || p.address || '');
        setEmgLocation((prev) => prev || p.address || '');
        setEmgPhone((prev) => prev || p.phone || '');
      }
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err, 'Failed to load workspace') });
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    try {
      const params = new URLSearchParams();
      if (docSearch) params.set('search', docSearch);
      if (docSpec !== 'all') params.set('specialization', docSpec);
      if (docHosp !== 'all') params.set('hospital_id', docHosp);
      if (docVideoOnly) params.set('video_only', 'true');
      const res = await api.get(`/doctors?${params.toString()}`);
      const list = res.data.doctors || [];
      setDoctors(list);
      if (!docSearch && docSpec === 'all' && docHosp === 'all' && !docVideoOnly) {
        setAllSpecializations(Array.from(new Set<string>(list.map((d: any) => d.specialization))));
      }
    } catch {
      // Ignore transient search error
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    void loadDoctors();
  }, [docSearch, docSpec, docHosp, docVideoOnly]);

  const handleAssistantNavigate = (tab: string, options?: NavigateOptions) => {
    if (options?.specialization) {
      const target = options.specialization.toLowerCase();
      const matched = allSpecializations.find(
        (s) => s.toLowerCase() === target || target.includes(s.toLowerCase().slice(0, 5)) || s.toLowerCase().includes(target.slice(0, 5))
      );
      if (matched) {
        setDocSpec(matched);
      } else {
        setDocSearch(options.specialization);
      }
    }
    if (options?.videoOnly !== undefined) {
      setDocVideoOnly(options.videoOnly);
    }
    setActiveTab(tab);
    if (options?.focusHospitals) {
      setTimeout(() => {
        hospitalsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleBookAppointment = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor) return;
    setFeedback(null);
    try {
      await api.post('/appointments', {
        doctor_id: bookingDoctor.id,
        appointment_date: bookDate,
        time_slot: bookSlot,
        mode: bookMode,
        reason: bookReason,
      });
      setFeedback({ type: 'ok', text: `Appointment booked with ${bookingDoctor.full_name}` });
      setBookingDoctor(null);
      setBookReason('');
      await loadAll();
      setActiveTab('appointments');
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleReschedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!rescheduleAppt) return;
    try {
      await api.patch(`/appointments/${rescheduleAppt.id}/reschedule`, {
        appointment_date: reschedDate,
        time_slot: reschedSlot,
      });
      setFeedback({ type: 'ok', text: 'Appointment rescheduled' });
      setRescheduleAppt(null);
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleCancelAppointment = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/cancel`);
      setFeedback({ type: 'ok', text: 'Appointment cancelled' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleOpenVidDoc = async (roomCode: string) => {
    try {
      const res = await api.get(`/consultations/${roomCode}`);
      setActiveRoom(res.data.consultation);
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleAddReminder = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/patient/reminders', {
        medicine_name: remName,
        dosage: remDosage,
        schedule_time: remTime,
        frequency: 'Daily',
      });
      setRemName('');
      setRemDosage('');
      setFeedback({ type: 'ok', text: 'Medicine reminder added' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleMarkReminderTaken = async (id: number) => {
    await api.patch(`/patient/reminders/${id}/taken`);
    await loadAll();
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    setRecFileName(file.name);
    setRecFileMime(file.type || 'application/octet-stream');
    setRecFileSize(file.size);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRecDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadRecord = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/records', {
        record_type: recType,
        title: recTitle,
        summary: recSummary,
        file_name: recFileName,
        file_mime: recFileMime,
        file_size_bytes: recFileSize,
        file_data_url: recDataUrl,
      });
      setRecTitle('');
      setRecSummary('');
      setRecFileName('');
      setRecFileMime('');
      setRecFileSize(0);
      setRecDataUrl('');
      setFeedback({ type: 'ok', text: 'Medical record uploaded' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const addToCart = (med: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.medicine.id === med.id);
      if (existing) {
        return prev.map((c) => (c.medicine.id === med.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { medicine: med, quantity: 1 }];
    });
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setFeedback(null);
    const pharmacyId = cart[0].medicine.pharmacy_id;
    try {
      await api.post('/orders', {
        pharmacy_id: pharmacyId,
        prescription_id: selectedRxId ? Number(selectedRxId) : null,
        delivery_address: deliveryAddress,
        items: cart.map((c) => ({ medicine_id: c.medicine.id, quantity: c.quantity })),
      });
      setCart([]);
      setFeedback({ type: 'ok', text: 'Pharmacy order submitted' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleCheckout = async (referenceType: 'appointment' | 'admission' | 'medicine_order', referenceId: number) => {
    setFeedback(null);
    try {
      const res = await api.post('/payments/checkout', {
        reference_type: referenceType,
        reference_id: referenceId,
        payment_method: 'razorpay_sandbox',
      });
      setFeedback({
        type: 'ok',
        text: `Paid · ${res.data.payment.invoice_number}`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleRequestEmergency = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.post('/emergency', {
        emergency_type: emgType,
        severity: emgSeverity,
        pickup_location: emgLocation,
        contact_phone: emgPhone,
        description: emgDesc,
      });
      setEmgDesc('');
      setFeedback({ type: 'ok', text: 'Ambulance dispatch requested' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await api.put('/patient/profile', {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
        dob: profileForm.dob,
        gender: profileForm.gender,
        blood_group: profileForm.blood_group,
        address: profileForm.address,
        emergency_contact_name: profileForm.emergency_contact_name,
        emergency_contact_phone: profileForm.emergency_contact_phone,
        allergies: profileForm.allergies,
        chronic_conditions: profileForm.chronic_conditions,
        insurance_provider: profileForm.insurance_provider,
        insurance_policy_no: profileForm.insurance_policy_no,
        height_cm: profileForm.height_cm,
        weight_kg: profileForm.weight_kg,
      });
      setFeedback({ type: 'ok', text: 'Profile saved' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'err', text: getApiErrorMessage(err) });
    }
  };

  const handleMarkNotifRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  };

  const handleMarkAllNotifsRead = async () => {
    await api.post('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  const filteredCatalog = catalog.filter(
    (m) =>
      !medSearch ||
      m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
      m.generic_name.toLowerCase().includes(medSearch.toLowerCase()) ||
      m.category.toLowerCase().includes(medSearch.toLowerCase())
  );

  const videoConsultations = appointments.filter((a) => a.mode === 'video');
  const patientDisplayName = dashboard?.patient?.full_name || user?.full_name || 'Patient';

  return (
    <PortalLayout
      theme="observatory"
      portalTitle="Patient Portal"
      portalSubtitle={dashboard?.patient?.mrn || ''}
      navItems={PATIENT_NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      primaryAction={
        <button
          type="button"
          onClick={() => setActiveTab('emergency')}
          className="obs-btn-danger inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] whitespace-nowrap shrink-0"
        >
          <Ambulance className="w-3.5 h-3.5" />
          <span>Emergency</span>
        </button>
      }
    >
      {feedback && (
        <div
          className={`mb-5 px-4 py-3 rounded-xl border text-[13px] font-medium flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'border-[#00ffaa]/40 bg-[#00ffaa]/10 text-[#00ffaa]'
              : 'border-[#ff6b6b]/40 bg-[#ff6b6b]/15 text-[#ff8f8f]'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-[12px] underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {loading && !dashboard && activeTab !== 'assistant' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 obs-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'assistant' && (
            <AIHealthAssistant patientName={patientDisplayName} onNavigate={handleAssistantNavigate} />
          )}

          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <div className="obs-card grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 text-[#8f93c4] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search doctor or specialty..."
                    className="w-full pl-9 pr-3 py-2 obs-input text-[13px]"
                  />
                </div>
                <select
                  value={docSpec}
                  onChange={(e) => setDocSpec(e.target.value)}
                  className="md:col-span-3 px-3 py-2 obs-input text-[13px]"
                >
                  <option value="all">All Specialties</option>
                  {allSpecializations.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={docHosp}
                  onChange={(e) => setDocHosp(e.target.value)}
                  className="md:col-span-2 px-3 py-2 obs-input text-[13px]"
                >
                  <option value="all">All Hospitals</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
                <label className="md:col-span-2 flex items-center gap-2 text-[13px] text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={docVideoOnly}
                    onChange={(e) => setDocVideoOnly(e.target.checked)}
                    className="accent-[#00b1ff]"
                  />
                  <span>VidDoc Only</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {doctors.map((doc) => (
                  <div key={doc.id} className="obs-card flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[16px] font-semibold text-white">{doc.full_name}</h3>
                          <p className="text-[12px] font-medium text-[#00b1ff] mt-0.5">{doc.specialization}</p>
                        </div>
                        <StatusBadge status={doc.verification_status} variant="observatory" />
                      </div>
                      <p className="text-[12px] text-[#b0b3d6] mt-2">
                        {doc.qualification} · {doc.hospital_name || 'Independent'}
                      </p>
                      <p className="text-[13px] text-white mt-1 font-mono-tabular">
                        {doc.experience_years} yrs · INR {doc.consultation_fee}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-mono-tabular text-[#b0b3d6]">
                        {doc.slot_start_time}–{doc.slot_end_time}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingDoctor(doc);
                          setBookMode(doc.is_available_for_video ? 'video' : 'in_person');
                        }}
                        className="obs-btn-primary px-4 py-1.5 text-[12px]"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div ref={hospitalsSectionRef} className="obs-card space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#00ffaa]" />
                  <h2 className="text-[17px] font-semibold text-white">Nearby CareOne Hospitals</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hospitals.map((h) => (
                    <div key={h.id} className="obs-card-inset p-4 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-semibold text-white">{h.name}</p>
                        <StatusBadge status={h.verification_status || 'verified'} variant="observatory" />
                      </div>
                      <p className="text-[12px] text-[#b0b3d6]">{h.address}, {h.city}</p>
                      <p className="text-[12px] font-mono-tabular text-[#00b1ff]">
                        {h.contact_phone} · {h.departments || 'Multi-Specialty'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="obs-card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-white">My Appointments</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('doctors')}
                  className="obs-btn-primary px-4 py-1.5 text-[12px]"
                >
                  New Booking
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-white/[0.04] text-[12px] text-[#b0b3d6]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Doctor</th>
                      <th className="px-6 py-3 font-medium">Schedule</th>
                      <th className="px-6 py-3 font-medium">Mode</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {appointments.map((a) => (
                      <tr key={a.id} className="hover:bg-white/[0.03]">
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-white">{a.doctor_name}</p>
                          <p className="text-[12px] text-[#b0b3d6]">
                            {a.specialization} · {a.hospital_name || 'Clinic'}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 font-mono-tabular text-white">
                          {a.appointment_date} {a.time_slot}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={a.mode} variant="observatory" />
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={a.status} variant="observatory" />
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-2 whitespace-nowrap">
                          {a.status === 'accepted' && a.room_code && (
                            <button
                              type="button"
                              onClick={() => handleOpenVidDoc(a.room_code)}
                              className="obs-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>VidDoc</span>
                            </button>
                          )}
                          {['pending', 'accepted', 'rescheduled'].includes(a.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleAppt(a);
                                  setReschedDate(a.appointment_date);
                                  setReschedSlot(a.time_slot);
                                }}
                                className="obs-btn-secondary px-3 py-1.5 text-[12px]"
                              >
                                Reschedule
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelAppointment(a.id)}
                                className="obs-btn-secondary px-3 py-1.5 text-[12px] text-[#ff6b6b]"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {a.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleCheckout('appointment', a.id)}
                              className="obs-btn-primary px-3.5 py-1.5 text-[12px]"
                            >
                              Pay Fee
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'viddoc' && (
            <div className="space-y-6">
              <div className="obs-card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold text-white">VidDoc Video Consultations</h2>
                  <p className="text-[13px] text-[#b0b3d6] mt-0.5">
                    Join an accepted video room or book a specialist offering online consultations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDocVideoOnly(true);
                    setActiveTab('doctors');
                  }}
                  className="obs-btn-primary inline-flex items-center gap-2 px-4 py-2 text-[12px]"
                >
                  <Video className="w-4 h-4" />
                  <span>Book VidDoc Slot</span>
                </button>
              </div>

              {videoConsultations.length === 0 ? (
                <div className="obs-card text-center py-10 space-y-3">
                  <p className="text-[14px] text-[#b0b3d6]">No video consultations scheduled yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDocVideoOnly(true);
                      setActiveTab('doctors');
                    }}
                    className="obs-btn-primary px-4 py-2 text-[13px]"
                  >
                    Find VidDoc Doctors
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videoConsultations.map((a) => (
                    <div key={a.id} className="obs-card space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[16px] font-semibold text-white">{a.doctor_name}</h3>
                          <p className="text-[12px] text-[#00b1ff]">
                            {a.specialization} · {a.hospital_name || 'CareOne Clinic'}
                          </p>
                        </div>
                        <StatusBadge status={a.status} variant="observatory" />
                      </div>
                      <p className="text-[12px] font-mono-tabular text-[#b0b3d6]">
                        {a.appointment_date} · {a.time_slot}
                        {a.room_code ? ` · Room ${a.room_code}` : ''}
                      </p>
                      {a.reason && <p className="text-[13px] text-[#e2e4f6]">{a.reason}</p>}
                      <div className="pt-2 border-t border-white/10 flex justify-end">
                        {a.status === 'accepted' && a.room_code ? (
                          <button
                            type="button"
                            onClick={() => handleOpenVidDoc(a.room_code)}
                            className="obs-btn-primary inline-flex items-center gap-2 px-4 py-2 text-[12px]"
                          >
                            <Video className="w-4 h-4 text-[#00ffaa]" />
                            <span>Join Video Room</span>
                          </button>
                        ) : (
                          <span className="text-[12px] text-[#8f93c4]">
                            Room activates once doctor accepts request
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <form onSubmit={handleUploadRecord} className="obs-card space-y-3.5">
                  <h2 className="text-[17px] font-semibold text-white">Upload Medical Record</h2>
                  <input
                    required
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    placeholder="Report or document title"
                    className="w-full px-3 py-2 obs-input text-[13px]"
                  />
                  <select
                    value={recType}
                    onChange={(e) => setRecType(e.target.value as any)}
                    className="w-full px-3 py-2 obs-input text-[13px]"
                  >
                    <option value="lab_report">Lab Report</option>
                    <option value="imaging">Imaging</option>
                    <option value="discharge_summary">Discharge Summary</option>
                    <option value="clinical_note">Clinical Note</option>
                    <option value="vaccination">Vaccination</option>
                  </select>
                  <textarea
                    rows={3}
                    value={recSummary}
                    onChange={(e) => setRecSummary(e.target.value)}
                    placeholder="Key findings or summary..."
                    className="w-full px-3 py-2 obs-input text-[13px]"
                  />
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    className="text-[12px] text-[#b0b3d6] block w-full"
                  />
                  <button type="submit" className="w-full obs-btn-primary py-2.5 text-[13px]">
                    Upload Record
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 obs-card space-y-3">
                <h2 className="text-[17px] font-semibold text-white">My Medical Records</h2>
                {records.length === 0 ? (
                  <p className="text-[13px] text-[#b0b3d6]">No medical records on file yet.</p>
                ) : (
                  <div className="divide-y divide-white/10">
                    {records.map((r) => (
                      <div key={r.id} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[14px] font-semibold text-white">{r.title}</p>
                            <p className="text-[12px] text-[#00b1ff] mt-0.5">
                              {r.record_type.replace(/_/g, ' ')} ·{' '}
                              <span className="font-mono-tabular">{r.record_date}</span>
                              {r.hospital_name ? ` · ${r.hospital_name}` : ''}
                            </p>
                          </div>
                          {r.file_data_url && (
                            <a
                              href={r.file_data_url}
                              download={r.file_name || 'medical_record'}
                              className="text-[12px] font-medium text-[#00ffaa] hover:underline shrink-0"
                            >
                              Download
                            </a>
                          )}
                        </div>
                        {r.summary && <p className="text-[13px] text-[#b0b3d6] mt-1.5">{r.summary}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              <h2 className="text-[18px] font-semibold text-white">Digital Prescriptions</h2>
              {prescriptions.length === 0 ? (
                <div className="obs-card text-[13px] text-[#b0b3d6]">No prescriptions issued yet.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {prescriptions.map((rx) => (
                    <div key={rx.id} className="obs-card space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-semibold text-white">
                            Rx #{rx.id} · {rx.diagnosis}
                          </p>
                          <p className="text-[12px] text-[#b0b3d6]">
                            {rx.doctor_name} · <span className="font-mono-tabular">{rx.valid_until}</span>
                          </p>
                        </div>
                        <StatusBadge status={rx.status} variant="observatory" />
                      </div>
                      <div className="divide-y divide-white/10 border-t border-white/10">
                        {(rx.items || []).map((item: any) => (
                          <div key={item.id} className="py-2.5 text-[13px] flex justify-between gap-2">
                            <div>
                              <p className="font-semibold text-white">{item.medicine_name}</p>
                              <p className="text-[#b0b3d6]">
                                {item.dosage} · {item.frequency}
                              </p>
                            </div>
                            <span className="font-mono-tabular text-[#00b1ff] shrink-0">{item.duration_days}d</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRxId(String(rx.id));
                            setActiveTab('pharmacy');
                          }}
                          className="obs-btn-primary px-4 py-1.5 text-[12px]"
                        >
                          Order Medicines
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pharmacy' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[18px] font-semibold text-white">Medicines & Pharmacy Catalog</h2>
                  <input
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    placeholder="Filter medicines..."
                    className="px-3.5 py-2 obs-input text-[13px]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredCatalog.map((m) => (
                    <div key={m.id} className="obs-card flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[15px] font-semibold text-white">{m.name}</p>
                          <span className="font-mono-tabular text-[14px] font-semibold text-[#00ffaa]">
                            INR {m.unit_price}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#b0b3d6] mt-0.5">
                          {m.generic_name} · {m.category}
                        </p>
                        <p className="text-[12px] text-[#00b1ff] mt-1">
                          {m.pharmacy_name} · <span className="font-mono-tabular">{m.stock_quantity}</span> in stock
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <span className="text-[12px] text-[#b0b3d6]">
                          {m.requires_prescription ? 'Rx Required' : 'OTC'}
                        </span>
                        <button
                          type="button"
                          onClick={() => addToCart(m)}
                          className="obs-btn-primary px-3.5 py-1.5 text-[12px]"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <form onSubmit={handlePlaceOrder} className="obs-card space-y-4">
                  <h3 className="text-[16px] font-semibold text-white">Order Basket</h3>
                  {cart.length === 0 ? (
                    <p className="text-[13px] text-[#b0b3d6]">Basket empty</p>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((c) => (
                        <div
                          key={c.medicine.id}
                          className="flex items-center justify-between text-[13px] py-2 border-b border-white/10"
                        >
                          <span className="text-white">
                            {c.medicine.name} x {c.quantity}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono-tabular text-[#00ffaa]">
                              INR {c.medicine.unit_price * c.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCart((prev) => prev.filter((x) => x.medicine.id !== c.medicine.id))}
                              className="text-[12px] text-[#ff6b6b] hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <p className="text-right text-[15px] font-semibold font-mono-tabular text-[#00ffaa] pt-1">
                        Total: INR {cart.reduce((s, c) => s + c.medicine.unit_price * c.quantity, 0)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Prescription</label>
                    <select
                      value={selectedRxId}
                      onChange={(e) => setSelectedRxId(e.target.value)}
                      className="w-full px-3 py-2 obs-input text-[13px]"
                    >
                      <option value="">None (OTC)</option>
                      {prescriptions.map((rx) => (
                        <option key={rx.id} value={rx.id}>
                          Rx #{rx.id} — {rx.diagnosis}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Delivery Address</label>
                    <input
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-3 py-2 obs-input text-[13px]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={cart.length === 0}
                    className="w-full obs-btn-primary py-2.5 text-[13px] disabled:opacity-40"
                  >
                    Place Order
                  </button>
                </form>

                <div className="obs-card space-y-2">
                  <h3 className="text-[16px] font-semibold text-white">My Orders</h3>
                  <div className="divide-y divide-white/10">
                    {orders.map((o) => (
                      <div key={o.id} className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-white font-mono-tabular">
                            #{o.id} · {o.pharmacy_name}
                          </span>
                          <StatusBadge status={o.status} variant="observatory" />
                        </div>
                        <p className="text-[12px] text-[#b0b3d6]">
                          {(o.items || []).map((i: any) => `${i.medicine_name} (${i.quantity})`).join(', ')}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[12px] font-mono-tabular text-[#00ffaa]">
                            INR {o.total_amount} · {o.payment_status}
                          </span>
                          {o.payment_status === 'unpaid' && o.status !== 'rejected' && o.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCheckout('medicine_order', o.id)}
                              className="obs-btn-primary px-3.5 py-1 text-[12px]"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reminders' && dashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="obs-card">
                  <p className="text-[12px] font-medium text-[#b0b3d6]">Upcoming Visits</p>
                  <p className="mt-1.5 text-[32px] leading-none font-semibold font-mono-tabular text-[#00b1ff]">
                    {dashboard.stats.upcoming_appointments}
                  </p>
                </div>
                <div className="obs-card">
                  <p className="text-[12px] font-medium text-[#b0b3d6]">Active Prescriptions</p>
                  <p className="mt-1.5 text-[32px] leading-none font-semibold font-mono-tabular text-[#00ffaa]">
                    {dashboard.stats.active_prescriptions}
                  </p>
                </div>
                <div className="obs-card">
                  <p className="text-[12px] font-medium text-[#b0b3d6]">Medical Records</p>
                  <p className="mt-1.5 text-[32px] leading-none font-semibold font-mono-tabular text-white">
                    {dashboard.stats.medical_records_count}
                  </p>
                </div>
                <div className="obs-card">
                  <p className="text-[12px] font-medium text-[#b0b3d6]">Pending Orders</p>
                  <p className="mt-1.5 text-[32px] leading-none font-semibold font-mono-tabular text-white">
                    {dashboard.stats.pending_orders}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 obs-card space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[17px] font-semibold text-white">Daily Medicine Reminders</h2>
                    <HeartPulse className="w-4 h-4 text-[#00ffaa]" />
                  </div>
                  <div className="divide-y divide-white/10">
                    {(dashboard.reminders || []).length === 0 ? (
                      <p className="py-6 text-[13px] text-[#b0b3d6]">No medicine reminders scheduled.</p>
                    ) : (
                      (dashboard.reminders || []).map((r: any) => (
                        <div key={r.id} className="py-3.5 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[14px] font-semibold text-white">{r.medicine_name}</p>
                            <p className="text-[12px] text-[#00b1ff] font-mono-tabular">
                              {r.dosage} · {r.schedule_time}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMarkReminderTaken(r.id)}
                            className="obs-btn-secondary px-3.5 py-1.5 text-[12px] text-[#00ffaa] whitespace-nowrap"
                          >
                            {r.last_taken_at ? 'Taken' : 'Mark Taken'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <form onSubmit={handleAddReminder} className="lg:col-span-5 obs-card space-y-3.5">
                  <h3 className="text-[16px] font-semibold text-white">Add Reminder</h3>
                  <div>
                    <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Medicine Name</label>
                    <input
                      required
                      value={remName}
                      onChange={(e) => setRemName(e.target.value)}
                      placeholder="e.g., Telmisartan 40mg"
                      className="w-full px-3 py-2 obs-input text-[13px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Dosage</label>
                      <input
                        required
                        value={remDosage}
                        onChange={(e) => setRemDosage(e.target.value)}
                        placeholder="1 tablet"
                        className="w-full px-3 py-2 obs-input text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Time</label>
                      <input
                        type="time"
                        value={remTime}
                        onChange={(e) => setRemTime(e.target.value)}
                        className="w-full px-3 py-2 obs-input text-[13px] font-mono-tabular"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full obs-btn-primary py-2.5 text-[13px]">
                    Add Reminder
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'emergency' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-5">
                <form onSubmit={handleRequestEmergency} className="obs-card space-y-3.5 border-[#ff6b6b]/35">
                  <div className="flex items-center gap-2 text-[#ff6b6b]">
                    <Ambulance className="w-4 h-4" />
                    <h2 className="text-[17px] font-semibold text-white">Request Emergency Ambulance</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Emergency Type</label>
                      <input
                        required
                        value={emgType}
                        onChange={(e) => setEmgType(e.target.value)}
                        className="w-full px-3 py-2 obs-input text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Severity</label>
                      <select
                        value={emgSeverity}
                        onChange={(e) => setEmgSeverity(e.target.value as any)}
                        className="w-full px-3 py-2 obs-input text-[13px]"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="moderate">Moderate</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Pickup Location</label>
                      <input
                        required
                        value={emgLocation}
                        onChange={(e) => setEmgLocation(e.target.value)}
                        className="w-full px-3 py-2 obs-input text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Contact Phone</label>
                      <input
                        required
                        value={emgPhone}
                        onChange={(e) => setEmgPhone(e.target.value)}
                        className="w-full px-3 py-2 obs-input text-[13px]"
                      />
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={emgDesc}
                    onChange={(e) => setEmgDesc(e.target.value)}
                    placeholder="Symptoms or location details..."
                    className="w-full px-3 py-2 obs-input text-[13px]"
                  />
                  <button type="submit" className="w-full obs-btn-danger py-2.5 text-[13px]">
                    Dispatch Ambulance
                  </button>
                </form>

                <div className="obs-card space-y-2">
                  <h3 className="text-[16px] font-semibold text-white">Active & Past Requests</h3>
                  {emergencies.length === 0 ? (
                    <p className="text-[13px] text-[#b0b3d6]">No emergency requests.</p>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {emergencies.map((er) => (
                        <div key={er.id} className="py-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[14px] font-semibold text-white">{er.emergency_type}</span>
                            <StatusBadge status={er.status} variant="observatory" />
                          </div>
                          <p className="text-[12px] text-[#b0b3d6]">{er.pickup_location}</p>
                          {er.ambulance_unit && (
                            <p className="text-[12px] font-mono-tabular text-[#00ffaa]">
                              {er.ambulance_unit} · ETA {er.eta_minutes}m
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-6 obs-card space-y-3">
                <h2 className="text-[17px] font-semibold text-white">Financial Assistance Programs</h2>
                <div className="divide-y divide-white/10">
                  {aidPrograms.map((prog) => (
                    <div key={prog.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                      <p className="text-[14px] font-semibold text-white">{prog.title}</p>
                      <p className="text-[12px] text-[#00b1ff]">
                        {prog.provider} · {prog.category}
                      </p>
                      <p className="text-[12px] font-mono-tabular text-[#00ffaa]">{prog.coverage_limit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="obs-card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-white">Payments & Invoices</h2>
                <span className="text-[12px] font-mono-tabular text-[#00b1ff]">{gatewayMode}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-white/[0.04] text-[12px] text-[#b0b3d6]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Invoice</th>
                      <th className="px-6 py-3 font-medium">Reference</th>
                      <th className="px-6 py-3 font-medium">Transaction ID</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {payments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-white/[0.03]">
                        <td className="px-6 py-3.5 font-mono-tabular text-white">{pay.invoice_number}</td>
                        <td className="px-6 py-3.5 text-[#b0b3d6] capitalize">
                          {pay.reference_type.replace(/_/g, ' ')} #{pay.reference_id}
                        </td>
                        <td className="px-6 py-3.5 font-mono-tabular text-[#b0b3d6]">{pay.transaction_id}</td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={pay.status} variant="observatory" />
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono-tabular font-semibold text-[#00ffaa]">
                          {pay.currency} {pay.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="obs-card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold text-white">Notifications</h2>
                <button
                  type="button"
                  onClick={handleMarkAllNotifsRead}
                  className="obs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] text-[#00b1ff]"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              </div>
              {notifications.length === 0 ? (
                <p className="text-[13px] text-[#b0b3d6] py-6 text-center">No notifications right now.</p>
              ) : (
                <div className="divide-y divide-white/10">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleMarkNotifRead(n.id)}
                      className={`w-full text-left py-3.5 px-3 rounded-xl transition-colors ${
                        n.is_read ? 'opacity-65' : 'bg-[#5350cc]/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold text-white">{n.title}</span>
                        <span className="text-[11px] font-mono-tabular text-[#00b1ff]">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#b0b3d6] mt-1">{n.message}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="obs-card space-y-5">
              <h2 className="text-[17px] font-semibold text-white">My Health Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Full Name</label>
                  <input
                    value={profileForm.full_name || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Phone</label>
                  <input
                    value={profileForm.phone || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Blood Group</label>
                  <input
                    value={profileForm.blood_group || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={profileForm.height_cm || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, height_cm: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={profileForm.weight_kg || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, weight_kg: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={profileForm.dob || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px] font-mono-tabular"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Address</label>
                  <input
                    value={profileForm.address || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Allergies</label>
                  <input
                    value={profileForm.allergies || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Chronic Conditions</label>
                  <input
                    value={profileForm.chronic_conditions || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, chronic_conditions: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Insurance</label>
                  <input
                    value={profileForm.insurance_provider || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, insurance_provider: e.target.value })}
                    className="w-full px-3.5 py-2 obs-input text-[14px]"
                  />
                </div>
              </div>
              <button type="submit" className="obs-btn-primary px-5 py-2.5 text-[13px]">
                Save Profile
              </button>
            </form>
          )}
        </>
      )}

      {bookingDoctor && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleBookAppointment} className="w-full max-w-md obs-card space-y-4 border-[#00b1ff]/40">
            <div>
              <h3 className="text-[17px] font-semibold text-white">Book {bookingDoctor.full_name}</h3>
              <p className="text-[12px] text-[#00b1ff]">
                {bookingDoctor.specialization} · INR {bookingDoctor.consultation_fee}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Date</label>
                <input
                  required
                  type="date"
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="w-full px-3 py-2 obs-input text-[13px] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Time</label>
                <input
                  required
                  type="time"
                  value={bookSlot}
                  onChange={(e) => setBookSlot(e.target.value)}
                  className="w-full px-3 py-2 obs-input text-[13px] font-mono-tabular"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Mode</label>
              <select
                value={bookMode}
                onChange={(e) => setBookMode(e.target.value as any)}
                className="w-full px-3 py-2 obs-input text-[13px]"
              >
                <option value="video">VidDoc Video</option>
                <option value="in_person">In-Person</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Reason</label>
              <textarea
                required
                rows={3}
                value={bookReason}
                onChange={(e) => setBookReason(e.target.value)}
                placeholder="Reason for visit..."
                className="w-full px-3 py-2 obs-input text-[13px]"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setBookingDoctor(null)}
                className="obs-btn-secondary px-4 py-2 text-[13px]"
              >
                Cancel
              </button>
              <button type="submit" className="obs-btn-primary px-4 py-2 text-[13px]">
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}

      {rescheduleAppt && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleReschedule} className="w-full max-w-sm obs-card space-y-4 border-[#00b1ff]/40">
            <h3 className="text-[17px] font-semibold text-white">Reschedule Appointment</h3>
            <div>
              <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Date</label>
              <input
                required
                type="date"
                value={reschedDate}
                onChange={(e) => setReschedDate(e.target.value)}
                className="w-full px-3 py-2 obs-input text-[13px] font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#b0b3d6] mb-1">Time</label>
              <input
                required
                type="time"
                value={reschedSlot}
                onChange={(e) => setReschedSlot(e.target.value)}
                className="w-full px-3 py-2 obs-input text-[13px] font-mono-tabular"
              />
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRescheduleAppt(null)}
                className="obs-btn-secondary px-4 py-2 text-[13px]"
              >
                Cancel
              </button>
              <button type="submit" className="obs-btn-primary px-4 py-2 text-[13px]">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {activeRoom && (
        <VidDocRoom consultation={activeRoom} userRole="patient" onClose={() => setActiveRoom(null)} />
      )}
    </PortalLayout>
  );
}
