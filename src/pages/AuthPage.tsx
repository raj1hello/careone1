import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuthStore, type UserRole } from '../store/authStore.ts';

const DEMO_ACCOUNTS: Array<{
  role: UserRole;
  label: string;
  email: string;
}> = [
  { role: 'patient', label: 'Patient', email: 'patient@careone.health' },
  { role: 'doctor', label: 'Doctor', email: 'doctor@careone.health' },
  { role: 'hospital', label: 'Hospital', email: 'hospital@careone.health' },
  { role: 'pharmacy', label: 'Pharmacy', email: 'pharmacy@careone.health' },
];

export function AuthPage() {
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'patient' | 'doctor' | 'hospital' | 'pharmacy'>('patient');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [qualification, setQualification] = useState('MBBS, MD');
  const [licenseNo, setLicenseNo] = useState('');
  const [orgName, setOrgName] = useState('');
  const [city, setCity] = useState('Mumbai');

  const redirectForRole = (r: UserRole) => {
    if (r === 'admin') return '/hospital';
    return `/${r}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (mode === 'login') {
        const loggedUser = await login(email, password);
        navigate(redirectForRole(loggedUser.role));
      } else {
        const payload: Record<string, unknown> = {
          email,
          password,
          full_name: fullName,
          phone,
          role,
        };
        if (role === 'patient') {
          payload.dob = dob;
          payload.blood_group = bloodGroup;
        } else if (role === 'doctor') {
          payload.specialization = specialization;
          payload.qualification = qualification;
          payload.license_no = licenseNo || undefined;
          payload.hospital_id = 1;
        } else if (role === 'hospital' || role === 'pharmacy') {
          payload.organization_name = orgName || fullName;
          payload.registration_no = licenseNo || undefined;
          payload.city = city;
        }
        const registered = await register(payload);
        navigate(redirectForRole(registered.role));
      }
    } catch {
      // Error surfaced via Zustand store
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    clearError();
    try {
      const loggedUser = await login(demoEmail, 'CareOne@2026');
      navigate(redirectForRole(loggedUser.role));
    } catch {
      // Error surfaced via store
    }
  };

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
          <div className="lg:col-span-7 glass-card-elevated">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-black/[0.06]">
              <h1 className="text-[24px] font-semibold text-[#1d1d1f]">
                {mode === 'login' ? 'Sign In' : 'Create Account'}
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

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1.5">Role</label>
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
                        required
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
                    placeholder="name@careone.health"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Password</label>
                  <input
                    required
                    type="password"
                    minLength={mode === 'register' ? 8 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                  />
                </div>
              </div>

              {mode === 'register' && role === 'patient' && (
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
                </div>
              )}

              {mode === 'register' && role === 'doctor' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Specialization</label>
                    <input
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Qualification</label>
                    <input
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">License No.</label>
                    <input
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      placeholder="MCI-..."
                      className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (role === 'hospital' || role === 'pharmacy') && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Facility Name</label>
                    <input
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Facility Name"
                      className="w-full px-3.5 py-2.5 glass-input text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#6e6e73] mb-1">Registration</label>
                    <input
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
                <span>{isLoading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 glass-card flex flex-col justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1d1d1f]">Demo Portals</h2>
              <div className="mt-4 divide-y divide-black/[0.06] border-t border-b border-black/[0.06]">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDemoLogin(acc.email)}
                    className="w-full text-left py-3.5 px-2 hover:bg-black/[0.03] transition-colors flex items-center justify-between gap-3 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1d1d1f]">{acc.label}</p>
                      <p className="text-[12px] font-mono-tabular text-[#6e6e73] truncate">{acc.email}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#0071e3] shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 text-[12px] text-[#86868b]">
              Password: <span className="font-mono-tabular text-[#1d1d1f]">CareOne@2026</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
