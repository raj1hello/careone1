import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BedDouble,
  Building2,
  Pill,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';

interface PlatformHealth {
  verified_doctors: number;
  verified_hospitals: number;
  verified_pharmacies: number;
  available_beds: number;
}

const PORTAL_TABS = [
  {
    id: 'patient',
    label: 'Patient',
    icon: UserRound,
    metricLabel: 'Verified Doctors',
    items: [
      'Search doctors by specialty and hospital',
      'Book slots and join VidDoc video calls',
      'Access prescriptions, lab records, and orders',
    ],
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    metricLabel: 'Hospitals',
    items: [
      'Manage appointment requests and schedules',
      'Conduct WebRTC VidDoc calls with live vitals',
      'Issue multi-item digital prescriptions',
    ],
  },
  {
    id: 'hospital',
    label: 'Hospital',
    icon: Building2,
    metricLabel: 'Available Beds',
    items: [
      'Track and allocate General, Private, and ICU beds',
      'Manage OPD, admissions, discharge, and billing',
      'Verify doctors and dispatch ambulances',
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: Pill,
    metricLabel: 'Verified Pharmacies',
    items: [
      'Verify digital prescriptions against orders',
      'Deduct inventory atomically on approval',
      'Monitor low stock and 90-day expiry alerts',
    ],
  },
] as const;

export function LandingPage() {
  const { user } = useAuthStore();
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [activeTabId, setActiveTabId] = useState<(typeof PORTAL_TABS)[number]['id']>('patient');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setHealth(res.data))
      .catch(() => {});
  }, []);

  const portalHref = user ? `/${user.role === 'admin' ? 'hospital' : user.role}` : '/auth';
  const activeTab = PORTAL_TABS.find((t) => t.id === activeTabId) || PORTAL_TABS[0];

  const getMetricValue = () => {
    if (!health) return '—';
    if (activeTabId === 'patient') return String(health.verified_doctors);
    if (activeTabId === 'doctor') return String(health.verified_hospitals);
    if (activeTabId === 'hospital') return String(health.available_beds);
    return String(health.verified_pharmacies);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 h-16 bg-white/75 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between gap-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-[18px] font-semibold tracking-tight text-[#1d1d1f] whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 rounded-lg bg-[#1d1d1f] flex items-center justify-center shadow-xs">
              <Activity className="w-4 h-4 text-white" />
            </span>
            <span>CareOne</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#6e6e73]">
            <a href="#portals" className="hover:text-[#1d1d1f] transition-colors whitespace-nowrap shrink-0">
              Portals
            </a>
            <a href="#workflows" className="hover:text-[#1d1d1f] transition-colors whitespace-nowrap shrink-0">
              Workflows
            </a>
            <Link to="/auth" className="hover:text-[#1d1d1f] transition-colors whitespace-nowrap shrink-0">
              Demo Access
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to={portalHref}
              className="mac-btn-primary px-4 py-2 text-[13px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              <span>{user ? 'Open Portal' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero + Interactive Glass Console */}
      <section id="portals" className="max-w-[1200px] mx-auto px-6 pt-16 pb-16">
        <div className="max-w-2xl space-y-5">
          <h1
            className="font-display font-semibold text-[#1d1d1f] text-balance"
            style={{ fontSize: 'clamp(2.5rem, 4.6vw, 3.75rem)', lineHeight: 1.06, letterSpacing: '-0.035em' }}
          >
            Connected care across one clinical workspace.
          </h1>
          <p className="text-[17px] text-[#6e6e73] leading-relaxed">
            One Platform. Connected Healthcare. Better Care.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link to={portalHref} className="mac-btn-primary px-5 py-2.5 text-[14px] inline-flex items-center gap-2">
              <span>{user ? 'Open Active Portal' : 'Enter CareOne'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#workflows" className="mac-btn-secondary px-5 py-2.5 text-[14px]">
              Workflows
            </a>
          </div>
        </div>

        {/* Tactile Apple Glass Console Window */}
        <div className="mt-12 glass-card-elevated p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-4 bg-white/50">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/[0.05]">
              {PORTAL_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = tab.id === activeTabId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTabId(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                      active
                        ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#0071e3]' : ''}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <Link to="/auth" className="text-[13px] font-medium text-[#0071e3] hover:underline whitespace-nowrap">
              Launch {activeTab.label} →
            </Link>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-5">
              <div>
                <p className="text-[13px] font-medium text-[#6e6e73]">{activeTab.metricLabel}</p>
                <p className="mt-1 text-[52px] leading-none font-semibold font-mono-tabular text-[#1d1d1f]">
                  {getMetricValue()}
                </p>
              </div>
              <ul className="divide-y divide-black/[0.06] border-t border-black/[0.06]">
                {activeTab.items.map((item, idx) => (
                  <li key={idx} className="py-3 text-[14px] text-[#1d1d1f] flex items-center gap-3">
                    <span className="font-mono-tabular text-[12px] text-[#86868b] w-5 shrink-0">0{idx + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4 lg:border-l lg:border-black/[0.06] lg:pl-8">
              <div>
                <p className="text-[12px] text-[#6e6e73]">Doctors</p>
                <p className="mt-1 text-[28px] font-semibold font-mono-tabular text-[#1d1d1f]">
                  {health ? health.verified_doctors : '—'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#6e6e73]">Hospitals</p>
                <p className="mt-1 text-[28px] font-semibold font-mono-tabular text-[#1d1d1f]">
                  {health ? health.verified_hospitals : '—'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#6e6e73]">Free Beds</p>
                <p className="mt-1 text-[28px] font-semibold font-mono-tabular text-[#15803d]">
                  {health ? health.available_beds : '—'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#6e6e73]">Pharmacies</p>
                <p className="mt-1 text-[28px] font-semibold font-mono-tabular text-[#0071e3]">
                  {health ? health.verified_pharmacies : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflows */}
      <section id="workflows" className="max-w-[1200px] mx-auto px-6 pb-20">
        <h2 className="font-display text-[24px] font-semibold text-[#1d1d1f] mb-6">Core Clinical Workflows</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-2.5">
              <Stethoscope className="w-4 h-4 text-[#0071e3]" />
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Outpatient & VidDoc to Pharmacy</h3>
            </div>
            <ol className="divide-y divide-black/[0.06] text-[14px] text-[#1d1d1f]">
              <li className="py-2.5">1. Book verified specialist slot</li>
              <li className="py-2.5">2. Attend WebRTC VidDoc session</li>
              <li className="py-2.5">3. Receive signed digital prescription</li>
              <li className="py-2.5">4. Order medicines from verified pharmacy</li>
            </ol>
          </div>

          <div className="glass-card space-y-4">
            <div className="flex items-center gap-2.5">
              <BedDouble className="w-4 h-4 text-[#15803d]" />
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Emergency to Inpatient Discharge</h3>
            </div>
            <ol className="divide-y divide-black/[0.06] text-[14px] text-[#1d1d1f]">
              <li className="py-2.5">1. Request ambulance with pickup details</li>
              <li className="py-2.5">2. Assign ambulance unit and arrival ETA</li>
              <li className="py-2.5">3. Admit patient and allocate ward bed</li>
              <li className="py-2.5">4. Release bed, publish summary, and bill</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-black/[0.06] py-8 px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#6e6e73]">
          <span className="font-medium text-[#1d1d1f]">CareOne</span>
          <span>One Platform. Connected Healthcare. Better Care.</span>
        </div>
      </footer>
    </div>
  );
}
