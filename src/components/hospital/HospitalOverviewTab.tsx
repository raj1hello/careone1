import { useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  CalendarClock,
  Receipt,
  Stethoscope,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { ActivityLineChart, HorizontalBarList, RevenueBarChart } from '../HospitalCharts.tsx';
import {
  buildActivitySeries,
  buildDepartmentPerformance,
  buildOperationalAlerts,
  buildRevenueSeries,
  buildTodayTimeline,
  buildWardStats,
  type HospitalDashboardData,
} from './hospitalAnalytics.ts';

export type QuickActionKey =
  | 'register_patient'
  | 'admit_patient'
  | 'allocate_bed'
  | 'add_doctor'
  | 'create_bill'
  | 'view_appointments';

interface HospitalOverviewTabProps {
  data: HospitalDashboardData;
  dateRange: 7 | 30 | 90;
  onDateRangeChange: (d: 7 | 30 | 90) => void;
  onNavigateTab: (tab: string) => void;
  onQuickAction: (action: QuickActionKey) => void;
}

export function HospitalOverviewTab({
  data,
  dateRange,
  onDateRangeChange,
  onNavigateTab,
  onQuickAction,
}: HospitalOverviewTabProps) {
  const [revGranularity, setRevGranularity] = useState<'weekly' | 'monthly'>('monthly');

  const activitySeries = buildActivitySeries(data, dateRange);
  const wardStats = buildWardStats(data.beds);
  const deptPerformance = buildDepartmentPerformance(data);
  const revenueSeries = buildRevenueSeries(data, revGranularity);
  const timeline = buildTodayTimeline(data);
  const alerts = buildOperationalAlerts(data);

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* A. Minimal Command Center Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#202124]">Overview</h1>
          <p className="text-[13px] text-[#777D87] mt-0.5">
            {data.hospital?.name} · {todayFormatted}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onDateRangeChange(days)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                dateRange === days
                  ? 'bg-white text-[#16165c] shadow-xs border border-[#E5E7EB]'
                  : 'text-[#777D87] hover:text-[#202124]'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* I. Quick Actions Bar */}
      <div className="hosp-card-compact flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-[#777D87]">Quick Actions</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onQuickAction('register_patient')}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#5350cc]" />
            <span>Register Patient</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('admit_patient')}
            className="hosp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#00ffaa]" />
            <span>Admit Patient</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('allocate_bed')}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap"
          >
            <BedDouble className="w-3.5 h-3.5 text-[#5350cc]" />
            <span>Allocate Bed</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('add_doctor')}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap"
          >
            <Stethoscope className="w-3.5 h-3.5 text-[#5350cc]" />
            <span>Add Doctor</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('create_bill')}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap"
          >
            <Receipt className="w-3.5 h-3.5 text-[#5350cc]" />
            <span>Create Bill</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('view_appointments')}
            className="hosp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap"
          >
            <CalendarClock className="w-3.5 h-3.5 text-[#5350cc]" />
            <span>View Appointments</span>
          </button>
        </div>
      </div>

      {/* B. Hospital KPI Summary (6 Compact Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="hosp-card-compact flex flex-col justify-between">
          <p className="text-[12px] font-medium text-[#777D87]">Total Patients</p>
          <p className="mt-2 text-[26px] leading-none font-semibold font-mono-tabular text-[#202124]">
            {data.stats.total_patients}
          </p>
          <p className="mt-2 text-[11px] text-[#777D87]">Unique hospital records</p>
        </div>

        <div className="hosp-card-compact flex flex-col justify-between">
          <p className="text-[12px] font-medium text-[#777D87]">Currently Admitted</p>
          <p className="mt-2 text-[26px] leading-none font-semibold font-mono-tabular text-[#16165c]">
            {data.stats.active_inpatients}
          </p>
          <p className="mt-2 text-[11px] text-[#777D87] font-mono-tabular">
            OPD logged: {data.stats.opd_visits}
          </p>
        </div>

        <div className="hosp-card-compact flex flex-col justify-between">
          <p className="text-[12px] font-medium text-[#777D87]">Available Beds</p>
          <p className="mt-2 text-[26px] leading-none font-semibold font-mono-tabular text-[#067647]">
            {data.stats.available}
            <span className="text-[15px] text-[#A0A5AE] font-normal">/{data.stats.total}</span>
          </p>
          <p className="mt-2 text-[11px] text-[#777D87] font-mono-tabular">
            ICU free: {data.stats.icu_available}/{data.stats.icu_total}
          </p>
        </div>

        <div className="hosp-card-compact flex flex-col justify-between">
          <p className="text-[12px] font-medium text-[#777D87]">Doctors on Duty</p>
          <p className="mt-2 text-[26px] leading-none font-semibold font-mono-tabular text-[#5350cc]">
            {data.stats.verified_doctors}
          </p>
          <p className="mt-2 text-[11px] text-[#777D87] font-mono-tabular">
            Pending approval: {data.stats.pending_doctor_verifications}
          </p>
        </div>

        <div className="hosp-card-compact flex flex-col justify-between">
          <p className="text-[12px] font-medium text-[#777D87]">Today's Appointments</p>
          <p className="mt-2 text-[26px] leading-none font-semibold font-mono-tabular text-[#0369A1]">
            {data.stats.today_appointments}
          </p>
          <p className="mt-2 text-[11px] text-[#777D87] font-mono-tabular">
            Total scheduled: {data.appointments.length}
          </p>
        </div>

        <div className="hosp-card-compact flex flex-col justify-between">
          <p className="text-[12px] font-medium text-[#777D87]">Today's Revenue</p>
          <p className="mt-2 text-[22px] leading-none font-semibold font-mono-tabular text-[#202124]">
            INR {data.stats.today_collected_revenue.toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-[#777D87] font-mono-tabular">
            Collected · Total billed INR {data.stats.revenue_total.toLocaleString()}
          </p>
        </div>
      </div>

      {/* C. Hospital Activity Chart + H. Actionable Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 hosp-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold text-[#202124]">Hospital Activity</h2>
              <p className="text-[12px] text-[#777D87]">
                Visits, admissions, and discharges across the last {dateRange} days
              </p>
            </div>
          </div>
          <ActivityLineChart data={activitySeries} />
        </div>

        <div className="lg:col-span-4 hosp-card flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#202124]">Attention Required</h2>
              <span className="text-[11px] font-mono-tabular text-[#777D87]">
                {alerts.length} active
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="py-10 text-center space-y-1">
                <p className="text-[13px] font-medium text-[#067647]">All operations nominal</p>
                <p className="text-[12px] text-[#777D87]">No critical bottlenecks or pending approvals.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {alerts.map((alert) => (
                  <div key={alert.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 shrink-0 ${
                            alert.level === 'critical'
                              ? 'text-[#B91C1C]'
                              : alert.level === 'warning'
                                ? 'text-[#B45309]'
                                : 'text-[#0369A1]'
                          }`}
                        />
                        <p className="text-[13px] font-semibold text-[#202124]">{alert.title}</p>
                      </div>
                    </div>
                    <p className="text-[12px] text-[#777D87] leading-snug">{alert.detail}</p>
                    <button
                      type="button"
                      onClick={() => onNavigateTab(alert.targetTab)}
                      className="text-[12px] font-medium text-[#5350cc] hover:underline"
                    >
                      {alert.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* D. Ward Occupancy + E. Department Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 hosp-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#202124]">Ward Occupancy</h2>
              <p className="text-[12px] text-[#777D87]">Capacity and live bed utilization by ward type</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('beds')}
              className="text-[12px] font-medium text-[#5350cc] hover:underline"
            >
              Manage Beds
            </button>
          </div>

          <div className="space-y-4">
            {wardStats.map((w) => {
              const barColor =
                w.occupancyPct >= 85 ? '#DC2626' : w.occupancyPct >= 60 ? '#D97706' : '#5350cc';
              return (
                <div key={w.bedType} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-[#202124]">{w.label}</span>
                    <div className="flex items-center gap-3 font-mono-tabular text-[12px]">
                      <span className="text-[#777D87]">
                        {w.occupied}/{w.total} occupied ·{' '}
                        <span className={w.available === 0 && w.total > 0 ? 'text-[#B91C1C] font-semibold' : 'text-[#067647] font-semibold'}>
                          {w.available} free
                        </span>
                      </span>
                      <span className="w-10 text-right font-semibold text-[#202124]">{w.occupancyPct}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[#F1F3F6] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${w.total === 0 ? 0 : Math.max(w.occupied > 0 ? 4 : 0, w.occupancyPct)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 hosp-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#202124]">Department Performance</h2>
              <p className="text-[12px] text-[#777D87]">Recorded clinical visits across active departments</p>
            </div>
          </div>
          <HorizontalBarList
            items={deptPerformance.slice(0, 6)}
            unit="visits"
            emptyText="No departments configured yet."
          />
        </div>
      </div>

      {/* F. Revenue Analytics + G. Today's Hospital Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 hosp-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#202124]">Revenue Analytics</h2>
              <p className="text-[12px] text-[#777D87]">Billed gross charges separated from collected payments</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#F1F3F6] border border-[#E5E7EB] rounded-lg">
              {(['weekly', 'monthly'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setRevGranularity(view)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                    revGranularity === view
                      ? 'bg-white text-[#16165c] shadow-xs border border-[#E5E7EB]'
                      : 'text-[#777D87] hover:text-[#202124]'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 pb-2 border-b border-[#E5E7EB]">
            <div>
              <p className="text-[11px] text-[#777D87]">Billed Total</p>
              <p className="text-[14px] font-semibold font-mono-tabular text-[#5350cc] mt-0.5">
                INR {data.stats.revenue_total.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#777D87]">Collected</p>
              <p className="text-[14px] font-semibold font-mono-tabular text-[#0369A1] mt-0.5">
                INR {data.stats.collected_revenue.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#777D87]">Pending</p>
              <p className="text-[14px] font-semibold font-mono-tabular text-[#B45309] mt-0.5">
                INR {data.stats.pending_payments_total.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#777D87]">Insured</p>
              <p className="text-[14px] font-semibold font-mono-tabular text-[#067647] mt-0.5">
                INR {data.stats.insurance_covered.toLocaleString()}
              </p>
            </div>
          </div>

          <RevenueBarChart data={revenueSeries} />
        </div>

        <div className="lg:col-span-5 hosp-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#202124]">Recent Hospital Activity</h2>
              <p className="text-[12px] text-[#777D87]">Admissions, discharges, appointments & emergency logs</p>
            </div>
          </div>

          {timeline.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#777D87]">No activity logged yet.</p>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {timeline.map((item) => (
                <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#16165c]">{item.category}</p>
                    <p className="text-[12px] text-[#777D87] truncate mt-0.5">{item.detail}</p>
                  </div>
                  <span className="text-[11px] font-mono-tabular text-[#A0A5AE] shrink-0 whitespace-nowrap">
                    {String(item.time || '').slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
