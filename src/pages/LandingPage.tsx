import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BedDouble,
  Building2,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.ts';

const PORTAL_TABS = [
  {
    id: 'patient',
    label: 'Patient',
    icon: UserRound,
    headline: 'AI intake, doctor discovery & day-wise medicine tracking',
    items: [
      'Start with Gemini AI symptom intake & specialist matching',
      'Book verified doctors for VidDoc video or in-person visits',
      'Track authorized prescriptions & daily medicine doses',
    ],
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    headline: 'Verified clinical practice, WebRTC VidDoc & AI summaries',
    items: [
      'Verify medical credentials with affiliated CareOne hospitals',
      'Join private 2-person VidDoc rooms with consent-gated AI summaries',
      'Authorize digital prescriptions that auto-build patient courses',
    ],
  },
  {
    id: 'hospital',
    label: 'Hospital',
    icon: Building2,
    headline: 'Doctor verification, ward beds, admissions & dispatch',
    items: [
      'Review and verify affiliated doctors in real time',
      'Manage General, Private, and ICU beds and admissions',
      'Coordinate ambulance dispatch & live emergency requests',
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: Pill,
    headline: 'Prescription-linked medicine fulfillment & stock alerts',
    items: [
      'Publish verified medicine inventory & pricing',
      'Verify patient prescription orders in real time',
      'Coordinate preparation, dispatch, and delivery status',
    ],
  },
] as const;

export function LandingPage() {
  const { user } = useAuthStore();
  const [activeTabId, setActiveTabId] = useState<(typeof PORTAL_TABS)[number]['id']>('patient');

  const portalHref = user ? `/${user.role}` : '/auth';
  const activeTab = PORTAL_TABS.find((t) => t.id === activeTabId) || PORTAL_TABS[0];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
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
              Sign In / Register
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
              <span>{user ? 'Open Active Portal' : 'Get Started'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#workflows" className="mac-btn-secondary px-5 py-2.5 text-[14px]">
              Workflows
            </a>
          </div>
        </div>

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
              Sign in as {activeTab.label} →
            </Link>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#0071e3]">
                  {activeTab.label} Portal
                </p>
                <p className="mt-1.5 text-[20px] font-semibold text-[#1d1d1f] leading-snug">
                  {activeTab.headline}
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

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:border-l lg:border-black/[0.06] lg:pl-8">
              <div className="glass-surface-inset p-4 space-y-1.5">
                <Video className="w-4 h-4 text-[#0071e3]" />
                <p className="text-[14px] font-semibold text-[#1d1d1f]">2-Person WebRTC VidDoc</p>
                <p className="text-[12px] text-[#6e6e73]">Private appointment-locked video & audio rooms.</p>
              </div>
              <div className="glass-surface-inset p-4 space-y-1.5">
                <Sparkles className="w-4 h-4 text-[#0071e3]" />
                <p className="text-[14px] font-semibold text-[#1d1d1f]">Consent-Gated AI</p>
                <p className="text-[12px] text-[#6e6e73]">Doctor-reviewed consultation summaries & triage.</p>
              </div>
              <div className="glass-surface-inset p-4 space-y-1.5">
                <Pill className="w-4 h-4 text-[#15803d]" />
                <p className="text-[14px] font-semibold text-[#1d1d1f]">Day-Wise Course</p>
                <p className="text-[12px] text-[#6e6e73]">Auto-scheduled daily slots from authorized Rx.</p>
              </div>
              <div className="glass-surface-inset p-4 space-y-1.5">
                <ShieldCheck className="w-4 h-4 text-[#15803d]" />
                <p className="text-[14px] font-semibold text-[#1d1d1f]">Real Cloud Sync</p>
                <p className="text-[12px] text-[#6e6e73]">Verified multi-device Firebase persistence.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflows" className="max-w-[1200px] mx-auto px-6 pb-20">
        <h2 className="font-display text-[24px] font-semibold text-[#1d1d1f] mb-6">Core Clinical Workflows</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-2.5">
              <Stethoscope className="w-4 h-4 text-[#0071e3]" />
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Outpatient & VidDoc to Medicine Course</h3>
            </div>
            <ol className="divide-y divide-black/[0.06] text-[14px] text-[#1d1d1f]">
              <li className="py-2.5">1. Book a hospital-verified specialist</li>
              <li className="py-2.5">2. Attend live WebRTC VidDoc session</li>
              <li className="py-2.5">3. Review consented AI summary & signed prescription</li>
              <li className="py-2.5">4. Follow your auto-generated day-wise medicine schedule</li>
            </ol>
          </div>

          <div className="glass-card space-y-4">
            <div className="flex items-center gap-2.5">
              <BedDouble className="w-4 h-4 text-[#15803d]" />
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Hospital Verification to Inpatient Care</h3>
            </div>
            <ol className="divide-y divide-black/[0.06] text-[14px] text-[#1d1d1f]">
              <li className="py-2.5">1. Verify affiliated doctors on CareOne</li>
              <li className="py-2.5">2. Allocate ward & ICU beds dynamically</li>
              <li className="py-2.5">3. Dispatch ambulances on live emergency requests</li>
              <li className="py-2.5">4. Coordinate outpatient & inpatient records securely</li>
            </ol>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/[0.06] py-8 px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#6e6e73]">
          <span className="font-medium text-[#1d1d1f]">CareOne</span>
          <span>One Platform. Connected Healthcare. Better Care.</span>
        </div>
      </footer>
    </div>
  );
}
