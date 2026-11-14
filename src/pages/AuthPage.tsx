import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  MailCheck,
  Pill,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Upload,
  UserRound,
} from 'lucide-react';
import { useAuthStore, type UserRole } from '../store/authStore.ts';
import {
  listVerifiedHospitalsOnce,
  uploadCareOneFile,
  type HospitalProfileDoc,
} from '../services/careoneDb.ts';

const SPECIALIZATIONS = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Pulmonology',
  'Orthopedics',
  'Dermatology',
  'Pediatrics',
  'Gynecology',
  'Endocrinology',
  'Psychiatry',
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function AuthPage() {
  const {
    firebaseUser,
    user,
    needsOnboarding,
    emailVerificationRequired,
    isLoading,
    error,
    clearError,
    signInWithGoogle,
    loginWithEmail,
    registerWithEmail,
    completeOnboarding,
    refreshVerificationStatus,
    resendVerificationEmail,
    logout,
  } = useAuthStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('patient');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [verificationNotice, setVerificationNotice] = useState('');

  // Patient fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');

  // Doctor fields
  const [specialization, setSpecialization] = useState('General Medicine');
  const [qualification, setQualification] = useState('MBBS, MD');
  const [licenseNo, setLicenseNo] = useState('');
  const [experienceYears, setExperienceYears] = useState(5);
  const [consultationFee, setConsultationFee] = useState(600);
  const [hospitalId, setHospitalId] = useState('');
  const [hospitals, setHospitals] = useState<HospitalProfileDoc[]>([]);
  const [bio, setBio] = useState('');
  const [availableDays, setAvailableDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('17:00');
  const [availableOnline, setAvailableOnline] = useState(true);
  const [availableInPerson, setAvailableInPerson] = useState(true);

  // Hospital / Pharmacy fields
  const [orgName, setOrgName] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [address, setAddress] = useState('');
  const [operatingHours, setOperatingHours] = useState('08:00 - 22:00');

  useEffect(() => {
    if (user && !needsOnboarding && !emailVerificationRequired) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [user, needsOnboarding, emailVerificationRequired, navigate]);

  useEffect(() => {
    if (firebaseUser?.displayName && !fullName) {
      setFullName(firebaseUser.displayName);
    }
    if (firebaseUser?.photoURL && !photoUrl) {
      setPhotoUrl(firebaseUser.photoURL);
    }
  }, [firebaseUser, fullName, photoUrl]);

  useEffect(() => {
    if (role === 'doctor' && (needsOnboarding || mode === 'register')) {
      listVerifiedHospitalsOnce()
        .then((rows) => setHospitals(rows))
        .catch(() => setHospitals([]));
    }
  }, [role, needsOnboarding, mode]);

  const toggleDay = (day: string) => {
    setAvailableDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      const uidPart = firebaseUser?.uid || `anon_${Date.now()}`;
      const url = await uploadCareOneFile(`doctor_photos/${uidPart}/${Date.now()}_${file.name}`, file);
      setPhotoUrl(url);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const buildDraftPayload = () => {
    const selectedHospital = hospitals.find((h) => h.uid === hospitalId);
    return {
      role,
      fullName: fullName.trim() || firebaseUser?.displayName || 'CareOne User',
      phone: phone.trim(),
      photoUrl: photoUrl.trim(),
      dob,
      gender,
      bloodGroup,
      allergies,
      chronicConditions,
      qualification,
      specialization,
      licenseNo,
      experienceYears: Number(experienceYears) || 0,
      consultationFee: Number(consultationFee) || 0,
      hospitalId: selectedHospital?.uid || '',
      hospitalName: selectedHospital?.name || 'Independent Practice',
      bio,
      availableDays: availableDays.length ? availableDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      slotStartTime,
      slotEndTime,
      availableOnline,
      availableInPerson,
      organizationName: orgName.trim() || fullName.trim(),
      city,
      state: stateName,
      address,
      operatingHours,
    };
  };

  const handleGoogleSignIn = async () => {
    clearError();
    try {
      const res = await signInWithGoogle();
      if (res.account && !res.needsOnboarding) {
        navigate(`/${res.account.role}`);
      }
    } catch {
      // Handled via store error
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (mode === 'login') {
        const res = await loginWithEmail(email, password);
        if (res.account && !res.needsOnboarding && !res.emailVerificationRequired) {
          navigate(`/${res.account.role}`);
        }
      } else {
        const res = await registerWithEmail(email, password, buildDraftPayload());
        if (res.account && !res.emailVerificationRequired) {
          navigate(`/${res.account.role}`);
        }
      }
    } catch {
      // Handled via store error
    }
  };

  const handleOnboardingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      const created = await completeOnboarding(buildDraftPayload());
      navigate(`/${created.role}`);
    } catch {
      // Handled via store error
    }
  };

  const roleCards: Array<{ id: UserRole; label: string; icon: typeof UserRound; desc: string }> = [
    { id: 'patient', label: 'Patient', icon: UserRound, desc: 'AI triage, appointments, VidDoc & prescriptions' },
    { id: 'doctor', label: 'Doctor', icon: Stethoscope, desc: 'Verified profile, video consults & AI summaries' },
    { id: 'hospital', label: 'Hospital', icon: Building2, desc: 'Verify doctors, beds, admissions & ambulance' },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill, desc: 'Verify Rx & fulfill real-time medicine orders' },
  ];

  // Screen A: Email verification required gate
  if (emailVerificationRequired && firebaseUser) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col justify-center px-6 py-10">
        <div className="max-w-lg w-full mx-auto glass-card-elevated space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <MailCheck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold">Verify Your Email</h1>
              <p className="text-[13px] text-[#6e6e73]">{firebaseUser.email}</p>
            </div>
          </div>

          <p className="text-[14px] text-[#1d1d1f] leading-relaxed">
            A verification link has been sent to your email address. CareOne Firestore security rules require a verified email before activating your account across devices.
          </p>

          {verificationNotice && (
            <p className="text-[13px] text-[#15803d] bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
              {verificationNotice}
            </p>
          )}
          {error && (
            <p className="text-[13px] text-[#dc2626] bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={async () => {
                const res = await refreshVerificationStatus();
                if (!res.verified) {
                  setVerificationNotice('Email is not verified yet. Please click the link in your inbox and retry.');
                }
              }}
              className="mac-btn-primary px-4 py-2.5 text-[13px] inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>I&apos;ve Verified — Continue</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={async () => {
                await resendVerificationEmail();
                setVerificationNotice('Verification email resent.');
              }}
              className="mac-btn-secondary px-4 py-2.5 text-[13px]"
            >
              Resend Email
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="mac-btn-secondary px-4 py-2.5 text-[13px]"
            >
              Use Another Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Screen B: Authenticated Firebase user completing CareOne role profile (First-time Google Sign-In)
  if (needsOnboarding && firebaseUser) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-[17px] font-semibold">
              <span className="w-6 h-6 rounded-md bg-[#1d1d1f] flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-white" />
              </span>
              <span>CareOne</span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]"
            >
              Sign out ({firebaseUser.email})
            </button>
          </div>

          <form onSubmit={handleOnboardingSubmit} className="glass-card-elevated space-y-5">
            <div className="pb-4 border-b border-black/[0.06]">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#0071e3]">
                Account Setup
              </p>
              <h1 className="text-[22px] font-semibold text-[#1d1d1f] mt-1">
                Complete your CareOne profile
              </h1>
              <p className="text-[13px] text-[#6e6e73] mt-0.5">
                Signed in as {firebaseUser.email}. Choose your portal role and complete your real account details.
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] mb-2">Select Portal Role</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {roleCards.map((rc) => {
                  const Icon = rc.icon;
                  const active = role === rc.id;
                  return (
                    <button
                      key={rc.id}
                      type="button"
                      onClick={() => setRole(rc.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-[#0071e3]/8 border-[#0071e3] shadow-2xs'
                          : 'bg-white border-black/[0.08] hover:border-black/20'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-[#0071e3]' : 'text-[#6e6e73]'}`} />
                      <p className="text-[13px] font-semibold text-[#1d1d1f] mt-1.5">{rc.label}</p>
                      <p className="text-[11px] text-[#6e6e73] leading-snug mt-0.5">{rc.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Full Name *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Phone Number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91-9800000000"
                  className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                />
              </div>
            </div>

            {role === 'patient' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Known Allergies</label>
                  <input
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. Penicillin, None"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Existing Conditions</label>
                  <input
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    placeholder="e.g. Hypertension, None"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
              </div>
            )}

            {role === 'doctor' && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-[#f5f5f7]/70 border border-black/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Doctor Credentials & Practice Details</p>
                    <p className="text-[11px] text-[#6e6e73]">
                      Profiles start as Pending Verification and become publicly bookable once verified by your affiliated hospital.
                    </p>
                  </div>
                  <label className="mac-btn-secondary px-3 py-1.5 text-[12px] inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>

                {photoError && <p className="text-[12px] text-[#b45309]">{photoError}</p>}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Medical Qualification *</label>
                    <input
                      required
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      placeholder="MBBS, MD"
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Specialization *</label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    >
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Medical Reg. No. *</label>
                    <input
                      required
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      placeholder="MCI-2026-..."
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Experience (Years) *</label>
                    <input
                      type="number"
                      min={0}
                      max={70}
                      required
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(Number(e.target.value))}
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Consultation Fee (INR) *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(Number(e.target.value))}
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Hospital Affiliation</label>
                    <select
                      value={hospitalId}
                      onChange={(e) => setHospitalId(e.target.value)}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Available Days</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(d)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            availableDays.includes(d)
                              ? 'bg-[#0071e3] text-white'
                              : 'bg-white border border-black/[0.08] text-[#6e6e73]'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">From</label>
                      <input
                        type="time"
                        value={slotStartTime}
                        onChange={(e) => setSlotStartTime(e.target.value)}
                        className="w-full px-2.5 py-2 glass-input text-[13px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">To</label>
                      <input
                        type="time"
                        value={slotEndTime}
                        onChange={(e) => setSlotEndTime(e.target.value)}
                        className="w-full px-2.5 py-2 glass-input text-[13px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[13px]">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={availableOnline}
                      onChange={(e) => setAvailableOnline(e.target.checked)}
                    />
                    <span>Available for Online VidDoc</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={availableInPerson}
                      onChange={(e) => setAvailableInPerson(e.target.checked)}
                    />
                    <span>Available for In-Person Clinic</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Professional Description</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief clinical background and areas of focus..."
                    className="w-full px-3 py-2 glass-input text-[13px]"
                  />
                </div>
              </div>
            )}

            {(role === 'hospital' || role === 'pharmacy') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">
                    {role === 'hospital' ? 'Hospital Name *' : 'Pharmacy Name *'}
                  </label>
                  <input
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={role === 'hospital' ? 'e.g. City Care Multispecialty Hospital' : 'e.g. MedPlus Care Pharmacy'}
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Registration / License No. *</label>
                  <input
                    required
                    value={licenseNo}
                    onChange={(e) => setLicenseNo(e.target.value)}
                    placeholder="REG-2026-..."
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Address</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-[13px] text-[#dc2626]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mac-btn-primary py-3 px-5 text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Creating Profile...' : 'Complete Registration'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Screen C: Primary Sign In / Registration Page (Zero Hardcoded Demo Accounts)
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col justify-center px-6 py-10">
      <div className="max-w-[1040px] w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>

          <div className="inline-flex items-center gap-2 text-[17px] font-semibold text-[#1d1d1f]">
            <span className="w-6 h-6 rounded-md bg-[#1d1d1f] flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-white" />
            </span>
            <span>CareOne</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 glass-card-elevated space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/[0.06]">
              <h1 className="text-[24px] font-semibold text-[#1d1d1f]">
                {mode === 'login' ? 'Sign In to CareOne' : 'Create Account'}
              </h1>

              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/[0.05]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    clearError();
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    mode === 'login' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    clearError();
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    mode === 'register' ? 'bg-white text-[#1d1d1f] shadow-xs' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Google Sign-In (Primary Firebase Auth Provider) */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleGoogleSignIn()}
              className="w-full py-3 px-4 rounded-xl bg-white border border-black/[0.12] hover:bg-[#fafafa] text-[14px] font-medium text-[#1d1d1f] inline-flex items-center justify-center gap-2.5 shadow-2xs transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-[#0071e3]" />
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-black/[0.08]" />
              <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                or with email
              </span>
              <div className="flex-1 border-t border-black/[0.08]" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1.5">Portal Role</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['patient', 'doctor', 'hospital', 'pharmacy'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2 px-3 rounded-xl text-[13px] font-medium capitalize transition-all ${
                            role === r
                              ? 'bg-[#0071e3] text-white shadow-xs'
                              : 'mac-btn-secondary text-[#1d1d1f]'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Full Name</label>
                      <input
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Phone</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91-9800000000"
                        className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Password</label>
                  <input
                    required
                    type="password"
                    minLength={mode === 'register' ? 6 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
              </div>

              {mode === 'register' && role === 'doctor' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Specialization</label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    >
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Qualification</label>
                    <input
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Med. Reg. No.</label>
                    <input
                      required
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      placeholder="MCI-..."
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (role === 'hospital' || role === 'pharmacy') && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Facility Name</label>
                    <input
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Facility Name"
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Registration No.</label>
                    <input
                      required
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      placeholder="REG-2026-..."
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">City</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-2 glass-input text-[13px]"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-[13px] text-[#dc2626]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mac-btn-primary py-3 px-5 text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 glass-card flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Connected CareOne Portals</h2>
              <p className="text-[13px] text-[#6e6e73] leading-relaxed">
                Every CareOne account uses real Firebase authentication and cloud persistence across devices—no mock users or local-only data.
              </p>

              <div className="divide-y divide-black/[0.06] border-t border-b border-black/[0.06]">
                {roleCards.map((rc) => {
                  const Icon = rc.icon;
                  return (
                    <div key={rc.id} className="py-3 flex items-start gap-3">
                      <Icon className="w-4 h-4 text-[#0071e3] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[13px] font-semibold text-[#1d1d1f]">{rc.label} Portal</p>
                        <p className="text-[12px] text-[#6e6e73]">{rc.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f5f5f7] border border-black/[0.06] flex items-start gap-2.5 text-[12px] text-[#6e6e73]">
              <CheckCircle2 className="w-4 h-4 text-[#15803d] shrink-0 mt-0.5" />
              <span>
                Use Google Sign-In for instant multi-device onboarding, then select your portal role.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
