import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CalendarCheck2,
  Check,
  FileText,
  Pill,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import { PortalLayout, type NavItem } from '../components/PortalLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { VidDocRoom } from '../components/VidDocRoom.tsx';
import { useAuthStore } from '../store/authStore.ts';
import {
  authorizePrescriptionAndCourse,
  doctorRespondToAppointment,
  formatTimestamp,
  subscribeAppointmentsForUser,
  subscribeConsultationFeedbacksForDoctor,
  subscribeConsultationsForUser,
  subscribeDoctorOwnProfile,
  subscribeDoctorSharedRecords,
  subscribePrescriptionsForUser,
  subscribeVerifiedHospitals,
  updateDoctorProfile,
  uploadCareOneFile,
  type AppointmentDoc,
  type ConsultationDoc,
  type ConsultationFeedbackDoc,
  type DoctorProfileDoc,
  type HospitalProfileDoc,
  type MedicalRecordDoc,
  type PrescriptionDoc,
} from '../services/careoneDb.ts';
import {
  ALL_DOSE_SLOTS,
  FOOD_INSTRUCTION_OPTIONS,
  FREQUENCY_PRESETS,
  type DoseTimeSlot,
  type PrescribedMedicineItem,
} from '../utils/medicineSchedule.ts';

const NAV_ITEMS: NavItem[] = [
  { id: 'queue', label: 'Appointments', icon: CalendarCheck2 },
  { id: 'viddoc', label: 'VidDoc Consults', icon: Video },
  { id: 'patients', label: 'Authorized Patients', icon: Users },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'feedback', label: 'Patient Feedback', icon: Star },
  { id: 'profile', label: 'Doctor Profile', icon: UserCheck },
];


const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_MED_ITEM = (): PrescribedMedicineItem => ({
  medicineName: '',
  dosage: '',
  frequencyLabel: 'Twice daily (Morning & Evening)',
  timings: ['Morning', 'Evening'],
  durationDays: 5,
  foodInstruction: 'After food',
  precautions: '',
});

export function DoctorPortal() {
  const { user, refreshProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState('queue');

  const [docProfile, setDocProfile] = useState<DoctorProfileDoc | null>(null);
  const [hospitals, setHospitals] = useState<HospitalProfileDoc[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [consultations, setConsultations] = useState<ConsultationDoc[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionDoc[]>([]);
  const [sharedRecords, setSharedRecords] = useState<MedicalRecordDoc[]>([]);

  const [activeVidDoc, setActiveVidDoc] = useState<ConsultationDoc | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Reschedule modal
  const [reschedAppt, setReschedAppt] = useState<AppointmentDoc | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedSlot, setReschedSlot] = useState('11:00');
  const [reschedNote, setReschedNote] = useState('');

  // Standalone Prescription Builder
  const [rxPatientUid, setRxPatientUid] = useState('');
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [rxTreatment, setRxTreatment] = useState('');
  const [rxPrecautions, setRxPrecautions] = useState('');
  const [rxFollowUp, setRxFollowUp] = useState('');
  const [rxNotes, setRxNotes] = useState('');
  const [rxItems, setRxItems] = useState<PrescribedMedicineItem[]>([EMPTY_MED_ITEM()]);
  const [authorizingRx, setAuthorizingRx] = useState(false);

  // Profile Edit State
  const [profName, setProfName] = useState('');
  const [profPhoto, setProfPhoto] = useState('');
  const [profQual, setProfQual] = useState('');
  const [profSpec, setProfSpec] = useState('');
  const [profLicense, setProfLicense] = useState('');
  const [profExp, setProfExp] = useState(0);
  const [profFee, setProfFee] = useState(600);
  const [profHospitalId, setProfHospitalId] = useState('');
  const [profBio, setProfBio] = useState('');
  const [profDays, setProfDays] = useState<string[]>([]);
  const [profStart, setProfStart] = useState('09:00');
  const [profEnd, setProfEnd] = useState('17:00');
  const [profOnline, setProfOnline] = useState(true);
  const [profInPerson, setProfInPerson] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubs = [
      subscribeDoctorOwnProfile(user.uid, (p) => {
        setDocProfile(p);
        if (p) {
          setProfName(p.fullName || '');
          setProfPhoto(p.photoUrl || '');
          setProfQual(p.qualification || '');
          setProfSpec(p.specialization || '');
          setProfLicense(p.licenseNo || '');
          setProfExp(p.experienceYears || 0);
          setProfFee(p.consultationFee || 0);
          setProfHospitalId(p.hospitalId || '');
          setProfBio(p.bio || '');
          setProfDays(p.availableDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
          setProfStart(p.slotStartTime || '09:00');
          setProfEnd(p.slotEndTime || '17:00');
          setProfOnline(p.availableOnline !== false);
          setProfInPerson(p.availableInPerson !== false);
        }
      }),
      subscribeVerifiedHospitals(setHospitals),
      subscribeAppointmentsForUser(user.uid, 'doctor', setAppointments),
      subscribeConsultationsForUser(user.uid, 'doctor', setConsultations),
      subscribePrescriptionsForUser(user.uid, 'doctor', setPrescriptions),
      subscribeDoctorSharedRecords(user.uid, setSharedRecords),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  const authorizedPatients = useMemo(() => {
    const map = new Map<
      string,
      { uid: string; name: string; mrn?: string; allergies?: string; lastVisit: string; visitCount: number }
    >();
    for (const a of appointments) {
      if (['cancelled', 'rejected'].includes(a.status)) continue;
      const existing = map.get(a.patientUid);
      if (existing) {
        existing.visitCount += 1;
      } else {
        map.set(a.patientUid, {
          uid: a.patientUid,
          name: a.patientName,
          mrn: a.patientMrn,
          allergies: a.patientAllergies,
          lastVisit: `${a.appointmentDate} ${a.timeSlot}`,
          visitCount: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [appointments]);

  const consultationsMap = useMemo(() => {
    const map = new Map<string, ConsultationDoc>();
    for (const c of consultations) {
      map.set(c.appointmentId, c);
    }
    return map;
  }, [consultations]);

  const notify = (msg: string) => {
    setErrorMsg('');
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 5000);
  };

  const handleAppointmentAction = async (
    appt: AppointmentDoc,
    action: 'accepted' | 'rejected' | 'completed'
  ) => {
    if (!user) return;
    try {
      await doctorRespondToAppointment({
        appointment: appt,
        doctorUid: user.uid,
        action,
      });
      notify(`Appointment marked as ${action}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update appointment.');
    }
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    setErrorMsg('');
    try {
      const url = await uploadCareOneFile(`doctor_photos/${user.uid}/${Date.now()}_${file.name}`, file);
      setProfPhoto(url);
      await updateDoctorProfile(user.uid, { photoUrl: url });
      notify('Profile photograph uploaded.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg('');
    try {
      const selectedHospital = hospitals.find((h) => h.uid === profHospitalId);
      await updateDoctorProfile(user.uid, {
        fullName: profName,
        photoUrl: profPhoto,
        qualification: profQual,
        specialization: profSpec,
        licenseNo: profLicense,
        experienceYears: Number(profExp) || 0,
        consultationFee: Number(profFee) || 0,
        hospitalId: selectedHospital?.uid || '',
        hospitalName: selectedHospital?.name || 'Independent Practice',
        bio: profBio,
        availableDays: profDays,
        slotStartTime: profStart,
        slotEndTime: profEnd,
        availableOnline: profOnline,
        availableInPerson: profInPerson,
      });
      await refreshProfile();
      notify('Doctor profile updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update doctor profile.');
    }
  };

  const updateRxItem = (idx: number, patch: Partial<PrescribedMedicineItem>) => {
    setRxItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const toggleRxTiming = (idx: number, slot: DoseTimeSlot) => {
    setRxItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = it.timings.includes(slot)
          ? it.timings.filter((t) => t !== slot)
          : [...it.timings, slot];
        return { ...it, timings: next };
      })
    );
  };

  const handleAuthorizePrescription = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg('');
    const pat = authorizedPatients.find((p) => p.uid === rxPatientUid);
    if (!pat) {
      setErrorMsg('Select an authorized patient first.');
      return;
    }
    const validItems = rxItems.filter((i) => i.medicineName.trim());
    if (validItems.length === 0) {
      setErrorMsg('Add at least one medicine item.');
      return;
    }

    setAuthorizingRx(true);
    try {
      const res = await authorizePrescriptionAndCourse({
        patientUid: pat.uid,
        patientName: pat.name,
        doctorUid: user.uid,
        doctorName: docProfile?.fullName || user.fullName,
        doctorLicenseNo: docProfile?.licenseNo,
        doctorSpecialization: docProfile?.specialization,
        diagnosis: rxDiagnosis.trim(),
        treatmentRecommendations: rxTreatment,
        specialPrecautions: rxPrecautions,
        followUpDate: rxFollowUp,
        additionalInstructions: rxNotes,
        items: validItems,
      });
      setRxDiagnosis('');
      setRxTreatment('');
      setRxPrecautions('');
      setRxFollowUp('');
      setRxNotes('');
      setRxItems([EMPTY_MED_ITEM()]);
      notify(
        res.scheduleStatus === 'active'
          ? `Prescription authorized & day-wise medicine schedule activated for ${pat.name}.`
          : `Prescription authorized. Some incomplete timing/dosage fields were flagged for clarification.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to authorize prescription.');
    } finally {
      setAuthorizingRx(false);
    }
  };

  return (
    <PortalLayout
      portalTitle="Doctor Portal"
      portalSubtitle={docProfile?.specialization || 'Physician Console'}
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      theme="glass"
      headerMeta={
        docProfile && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${
              docProfile.verificationStatus === 'verified'
                ? 'bg-[#ECFDF3] text-[#067647]'
                : docProfile.verificationStatus === 'rejected'
                  ? 'bg-red-50 text-[#dc2626]'
                  : 'bg-[#FEF3C7] text-[#B45309]'
            }`}
          >
            {docProfile.verificationStatus === 'verified' ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" />
            )}
            <span className="capitalize">{docProfile.verificationStatus}</span>
          </span>
        )
      }
    >
      {activeVidDoc && (
        <VidDocRoom
          consultation={activeVidDoc}
          userRole="doctor"
          doctorLicenseNo={docProfile?.licenseNo}
          onClose={() => setActiveVidDoc(null)}
        />
      )}

      {docProfile && docProfile.verificationStatus !== 'verified' && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[13px] text-[#92400e] flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">
              Verification Status: {docProfile.verificationStatus.toUpperCase()}
            </p>
            <p className="text-[12px] mt-0.5">
              {docProfile.hospitalId
                ? `Your profile is awaiting verification by ${docProfile.hospitalName}. Once verified, patients can discover and book your slots.`
                : 'Select an affiliated hospital in your Doctor Profile so a CareOne hospital administrator can verify your credentials.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="mac-btn-secondary px-3.5 py-1.5 text-[12px]"
          >
            Review Profile
          </button>
        </div>
      )}

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-[#067647] flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-[#dc2626] flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: Appointments Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-semibold text-[#1d1d1f]">Patient Appointment Queue</h1>
              <p className="text-[13px] text-[#6e6e73]">
                Accept, reschedule, or start live VidDoc consultations with your patients.
              </p>
            </div>
            <div className="flex gap-2 text-[12px]">
              <span className="px-3 py-1.5 rounded-xl bg-white border border-black/[0.07]">
                Pending: <strong>{appointments.filter((a) => a.status === 'pending').length}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-black/[0.07]">
                Confirmed: <strong>{appointments.filter((a) => a.status === 'accepted').length}</strong>
              </span>
            </div>
          </div>

          {appointments.length === 0 ? (
            <div className="glass-card text-center py-12 text-[13px] text-[#6e6e73]">
              No patient appointment requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const consult = appt.consultationId ? consultationsMap.get(appt.consultationId) : undefined;
                return (
                  <div key={appt.id} className="glass-card flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1 min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{appt.patientName}</h3>
                        <StatusBadge status={appt.status} />
                      </div>
                      <p className="text-[12px] text-[#6e6e73] font-mono-tabular">
                        {appt.appointmentDate} · {appt.timeSlot} · {appt.mode === 'video' ? 'Online VidDoc' : 'In-Person'}
                        {appt.patientMrn ? ` · ${appt.patientMrn}` : ''}
                      </p>
                      <p className="text-[13px] text-[#1d1d1f]">Concern: {appt.reason}</p>
                      {appt.patientAllergies && (
                        <p className="text-[11px] text-[#b45309]">Allergies: {appt.patientAllergies}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {appt.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleAppointmentAction(appt, 'accepted')}
                            className="mac-btn-primary inline-flex items-center gap-1 px-3.5 py-2 text-[12px]"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReschedAppt(appt);
                              setReschedDate(appt.appointmentDate);
                              setReschedSlot(appt.timeSlot);
                              setReschedNote('');
                            }}
                            className="mac-btn-secondary px-3 py-2 text-[12px]"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAppointmentAction(appt, 'rejected')}
                            className="mac-btn-danger px-3 py-2 text-[12px]"
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {['accepted', 'rescheduled'].includes(appt.status) && consult && (
                        <>
                          {appt.mode === 'video' && consult.status !== 'ended' && (
                            <button
                              type="button"
                              onClick={() => setActiveVidDoc(consult)}
                              className="mac-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12px]"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Start VidDoc Room</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleAppointmentAction(appt, 'completed')}
                            className="mac-btn-secondary px-3 py-2 text-[12px]"
                          >
                            Mark Completed
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VidDoc Consultations */}
      {activeTab === 'viddoc' && (
        <div className="space-y-4">
          <h1 className="text-[22px] font-semibold text-[#1d1d1f]">VidDoc Consultation Sessions</h1>
          {consultations.length === 0 ? (
            <div className="glass-card text-center py-12 text-[13px] text-[#6e6e73]">
              Accept an appointment to initialize a private VidDoc room.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {consultations.map((c) => (
                <div key={c.id} className="glass-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{c.patientName}</h3>
                      <p className="text-[12px] font-mono-tabular text-[#6e6e73]">{c.roomCode}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-[12px] text-[#1d1d1f]">
                    Chief Complaint: {c.chiefComplaint || 'Pending assessment'}
                  </p>
                  <p className="text-[11px] text-[#6e6e73]">
                    Patient in room: {c.patientPresent ? 'Yes' : 'No'} · Consent:{' '}
                    {c.recordingConsent ? 'Granted' : 'Not granted'}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
                    <span className="text-[11px] text-[#6e6e73]">
                      {c.summaryApprovedByDoctor ? 'AI Summary Approved' : 'Notes Draft'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveVidDoc(c)}
                      className="mac-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px]"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{c.status === 'ended' ? 'View Session' : 'Open Room'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Authorized Patient History & Shared Records */}
      {activeTab === 'patients' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 glass-card space-y-3">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Authorized Patients</h2>
            <p className="text-[12px] text-[#6e6e73]">
              Showing only patients who have booked or consulted with you.
            </p>
            {authorizedPatients.length === 0 ? (
              <p className="text-[13px] text-[#6e6e73] py-6 text-center">No patient visits recorded yet.</p>
            ) : (
              <div className="divide-y divide-black/[0.06]">
                {authorizedPatients.map((p) => (
                  <div key={p.uid} className="py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-semibold text-[#1d1d1f]">{p.name}</p>
                      <p className="text-[11px] text-[#6e6e73]">
                        {p.mrn || 'MRN'} · Last visit: {p.lastVisit} · Visits: {p.visitCount}
                      </p>
                      {p.allergies && <p className="text-[11px] text-[#b45309]">Allergies: {p.allergies}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRxPatientUid(p.uid);
                        setActiveTab('prescriptions');
                      }}
                      className="mac-btn-secondary px-3 py-1.5 text-[12px]"
                    >
                      Prescribe
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 glass-card space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0071e3]" />
              <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Patient-Shared Medical Records</h2>
            </div>
            {sharedRecords.length === 0 ? (
              <p className="text-[13px] text-[#6e6e73] py-6 text-center">
                No medical records have been shared with you yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sharedRecords.map((rec) => (
                  <div key={rec.id} className="p-3.5 rounded-xl bg-[#f5f5f7] border border-black/[0.06] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[#1d1d1f]">{rec.title}</span>
                      <span className="text-[11px] font-mono-tabular text-[#6e6e73]">{rec.recordDate}</span>
                    </div>
                    <p className="text-[11px] text-[#6e6e73]">{rec.recordType.replace('_', ' ')}</p>
                    {rec.summary && <p className="text-[12px] text-[#1d1d1f]">{rec.summary}</p>}
                    {rec.fileUrl && (
                      <a
                        href={rec.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-[12px] font-medium text-[#0071e3] hover:underline pt-1"
                      >
                        Open Uploaded Report →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Digital Prescriptions */}
      {activeTab === 'prescriptions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAuthorizePrescription} className="lg:col-span-7 glass-card space-y-3.5">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              Authorize Digital Prescription &amp; Medicine Course
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">Authorized Patient *</label>
                <select
                  required
                  value={rxPatientUid}
                  onChange={(e) => setRxPatientUid(e.target.value)}
                  className="w-full px-3 py-2 glass-input text-[13px]"
                >
                  <option value="">Select patient...</option>
                  {authorizedPatients.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.name} ({p.mrn || 'Patient'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">Diagnosis *</label>
                <input
                  required
                  value={rxDiagnosis}
                  onChange={(e) => setRxDiagnosis(e.target.value)}
                  placeholder="Clinical diagnosis"
                  className="w-full px-3 py-2 glass-input text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {rxItems.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#f5f5f7] border border-black/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Medicine #{idx + 1}</span>
                    {rxItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRxItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[#dc2626] text-[11px] inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={item.medicineName}
                      onChange={(e) => updateRxItem(idx, { medicineName: e.target.value })}
                      placeholder="Medicine name *"
                      className="px-2.5 py-1.5 glass-input text-[12px]"
                    />
                    <input
                      value={item.dosage}
                      onChange={(e) => updateRxItem(idx, { dosage: e.target.value })}
                      placeholder="Dosage (e.g. 500mg)"
                      className="px-2.5 py-1.5 glass-input text-[12px]"
                    />
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={item.durationDays}
                      onChange={(e) => updateRxItem(idx, { durationDays: Number(e.target.value) })}
                      placeholder="Days"
                      className="px-2.5 py-1.5 glass-input text-[12px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={item.frequencyLabel}
                      onChange={(e) => {
                        const preset = FREQUENCY_PRESETS.find((p) => p.label === e.target.value);
                        updateRxItem(idx, {
                          frequencyLabel: e.target.value,
                          timings: preset ? preset.timings : item.timings,
                        });
                      }}
                      className="px-2.5 py-1.5 glass-input text-[12px]"
                    >
                      {FREQUENCY_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={item.foodInstruction}
                      onChange={(e) => updateRxItem(idx, { foodInstruction: e.target.value })}
                      className="px-2.5 py-1.5 glass-input text-[12px]"
                    >
                      {FOOD_INSTRUCTION_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ALL_DOSE_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleRxTiming(idx, slot)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          item.timings.includes(slot)
                            ? 'bg-[#0071e3] text-white'
                            : 'bg-white border border-black/[0.08] text-[#6e6e73]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRxItems((prev) => [...prev, EMPTY_MED_ITEM()])}
              className="mac-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Medicine</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                value={rxTreatment}
                onChange={(e) => setRxTreatment(e.target.value)}
                placeholder="Treatment recommendations"
                className="px-3 py-2 glass-input text-[12px]"
              />
              <input
                value={rxPrecautions}
                onChange={(e) => setRxPrecautions(e.target.value)}
                placeholder="Special precautions"
                className="px-3 py-2 glass-input text-[12px]"
              />
              <input
                type="date"
                value={rxFollowUp}
                onChange={(e) => setRxFollowUp(e.target.value)}
                className="px-3 py-2 glass-input text-[12px]"
              />
              <input
                value={rxNotes}
                onChange={(e) => setRxNotes(e.target.value)}
                placeholder="Additional instructions"
                className="px-3 py-2 glass-input text-[12px]"
              />
            </div>

            <button
              type="submit"
              disabled={authorizingRx}
              className="mac-btn-primary w-full py-2.5 text-[13px] disabled:opacity-50"
            >
              {authorizingRx ? 'Authorizing Prescription...' : 'Authorize Prescription & Generate Day-Wise Course'}
            </button>
          </form>

          <div className="lg:col-span-5 glass-card space-y-3">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Authorized Prescriptions Issued</h2>
            {prescriptions.length === 0 ? (
              <p className="text-[13px] text-[#6e6e73] py-6 text-center">No prescriptions issued yet.</p>
            ) : (
              <div className="space-y-2.5">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="p-3.5 rounded-xl bg-[#f5f5f7] border border-black/[0.06] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[#1d1d1f]">{rx.patientName}</span>
                      <StatusBadge status={rx.status} />
                    </div>
                    <p className="text-[12px] text-[#0071e3] font-medium">{rx.diagnosis}</p>
                    <p className="text-[11px] text-[#6e6e73]">
                      {rx.items.length} medicine(s) · {formatTimestamp(rx.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Doctor Profile & Verification Settings */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="glass-card max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.06]">
            <div className="flex items-center gap-3">
              {profPhoto ? (
                <img src={profPhoto} alt={profName} className="w-14 h-14 rounded-2xl object-cover border border-black/[0.08]" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] font-semibold flex items-center justify-center">
                  {profName.slice(0, 2).toUpperCase() || 'DR'}
                </div>
              )}
              <div>
                <h2 className="text-[18px] font-semibold text-[#1d1d1f]">{profName || user?.fullName}</h2>
                <p className="text-[12px] text-[#6e6e73]">
                  Status: <strong className="capitalize">{docProfile?.verificationStatus || 'pending'}</strong>
                </p>
              </div>
            </div>

            <label className="mac-btn-secondary px-3.5 py-2 text-[12px] inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-[#0071e3]" />
              <span>{uploadingPhoto ? 'Uploading...' : 'Upload Profile Photo'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Full Name</label>
              <input required value={profName} onChange={(e) => setProfName(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
            </div>
            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Medical Qualification</label>
              <input required value={profQual} onChange={(e) => setProfQual(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
            </div>
            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Specialization</label>
              <input required value={profSpec} onChange={(e) => setProfSpec(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
            </div>
            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Medical Registration No.</label>
              <input required value={profLicense} onChange={(e) => setProfLicense(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
            </div>
            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Experience (Years)</label>
              <input type="number" min={0} max={80} value={profExp} onChange={(e) => setProfExp(Number(e.target.value))} className="w-full px-3 py-2 glass-input text-[13px]" />
            </div>
            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Consultation Fee (INR)</label>
              <input type="number" min={0} value={profFee} onChange={(e) => setProfFee(Number(e.target.value))} className="w-full px-3 py-2 glass-input text-[13px]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] text-[#6e6e73] mb-1">Affiliated Hospital</label>
              <select
                value={profHospitalId}
                onChange={(e) => setProfHospitalId(e.target.value)}
                className="w-full px-3 py-2 glass-input text-[13px]"
              >
                <option value="">Independent Practice</option>
                {hospitals.map((h) => (
                  <option key={h.uid} value={h.uid}>
                    {h.name} ({h.city || 'CareOne'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12px] text-[#6e6e73] mb-1">Available Days</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setProfDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                      profDays.includes(d) ? 'bg-[#0071e3] text-white' : 'mac-btn-secondary'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">Start Time</label>
                <input type="time" value={profStart} onChange={(e) => setProfStart(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
              </div>
              <div>
                <label className="block text-[12px] text-[#6e6e73] mb-1">End Time</label>
                <input type="time" value={profEnd} onChange={(e) => setProfEnd(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-[13px]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={profOnline} onChange={(e) => setProfOnline(e.target.checked)} />
              <span>Available for Online VidDoc</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={profInPerson} onChange={(e) => setProfInPerson(e.target.checked)} />
              <span>Available for In-Person Clinic</span>
            </label>
          </div>

          <div>
            <label className="block text-[12px] text-[#6e6e73] mb-1">Professional Description</label>
            <textarea rows={3} value={profBio} onChange={(e) => setProfBio(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
          </div>

          <button type="submit" className="mac-btn-primary px-5 py-2.5 text-[13px]">
            Save Doctor Profile
          </button>
        </form>
      )}

      {/* Reschedule Modal */}
      {reschedAppt && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card-elevated max-w-sm w-full space-y-3.5">
            <h3 className="text-[16px] font-semibold">Reschedule {reschedAppt.patientName}</h3>
            <input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
            <input type="time" value={reschedSlot} onChange={(e) => setReschedSlot(e.target.value)} className="w-full px-3 py-2 glass-input text-[13px]" />
            <input
              value={reschedNote}
              onChange={(e) => setReschedNote(e.target.value)}
              placeholder="Note to patient (optional)"
              className="w-full px-3 py-2 glass-input text-[13px]"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReschedAppt(null)} className="mac-btn-secondary px-4 py-2 text-[12px]">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  await doctorRespondToAppointment({
                    appointment: reschedAppt,
                    doctorUid: user.uid,
                    action: 'rescheduled',
                    appointmentDate: reschedDate,
                    timeSlot: reschedSlot,
                    doctorNotes: reschedNote,
                  });
                  setReschedAppt(null);
                  notify('Appointment rescheduled.');
                }}
                className="mac-btn-primary px-4 py-2 text-[12px]"
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
