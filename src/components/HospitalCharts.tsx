import { useState } from 'react';

export interface ActivitySeriesPoint {
  label: string;
  fullDate: string;
  visits: number;
  admissions: number;
  discharges: number;
}

export function ActivityLineChart({
  data,
  height = 220,
  emptyText = 'No activity recorded in this period.',
}: {
  data: ActivitySeriesPoint[];
  height?: number;
  emptyText?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data.length) {
    return <p className="py-12 text-center text-[13px] text-[#777D87]">{emptyText}</p>;
  }

  const maxVal = Math.max(
    4,
    ...data.map((d) => Math.max(d.visits, d.admissions, d.discharges))
  );
  const w = 640;
  const h = height;
  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const getX = (i: number) =>
    data.length === 1 ? padL + chartW / 2 : padL + (i / (data.length - 1)) * chartW;
  const getY = (val: number) => padT + chartH - (val / maxVal) * chartH;

  const makePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`).join(' ');

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const step = Math.max(1, Math.ceil(data.length / 7));

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible" role="img" aria-label="Hospital Activity Chart">
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" strokeWidth="1" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#777D87" className="font-mono-tabular">
                  {tick}
                </text>
              </g>
            );
          })}

          {data.map((d, i) =>
            i % step === 0 || i === data.length - 1 ? (
              <text
                key={d.fullDate}
                x={getX(i)}
                y={h - 6}
                textAnchor="middle"
                fontSize="11"
                fill="#777D87"
                className="font-mono-tabular"
              >
                {d.label}
              </text>
            ) : null
          )}

          <path d={makePath(data.map((d) => d.visits))} fill="none" stroke="#16165c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={makePath(data.map((d) => d.admissions))} fill="none" stroke="#5350cc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={makePath(data.map((d) => d.discharges))} fill="none" stroke="#00b1ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {hoverIdx !== null && (
            <line
              x1={getX(hoverIdx)}
              y1={padT}
              x2={getX(hoverIdx)}
              y2={padT + chartH}
              stroke="#A0A5AE"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {data.map((d, i) => {
            const x = getX(i);
            return (
              <g key={d.fullDate}>
                {hoverIdx === i && (
                  <>
                    <circle cx={x} cy={getY(d.visits)} r="4" fill="#16165c" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={x} cy={getY(d.admissions)} r="4" fill="#5350cc" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={x} cy={getY(d.discharges)} r="4" fill="#00b1ff" stroke="#fff" strokeWidth="1.5" />
                  </>
                )}
                <rect
                  x={x - chartW / Math.max(data.length, 4) / 2}
                  y={padT}
                  width={chartW / Math.max(data.length, 2)}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              </g>
            );
          })}
        </svg>

        {hovered && hoverIdx !== null && (
          <div
            className="absolute top-1 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 shadow-sm text-[11px] pointer-events-none z-10"
            style={{
              left: hoverIdx > data.length / 2 ? 'auto' : `${Math.min(72, (hoverIdx / Math.max(1, data.length - 1)) * 75 + 6)}%`,
              right: hoverIdx > data.length / 2 ? '8%' : 'auto',
            }}
          >
            <p className="font-semibold text-[#202124] mb-1 font-mono-tabular">{hovered.fullDate}</p>
            <p className="text-[#16165c] font-mono-tabular">Visits: {hovered.visits}</p>
            <p className="text-[#5350cc] font-mono-tabular">Admissions: {hovered.admissions}</p>
            <p className="text-[#0369A1] font-mono-tabular">Discharges: {hovered.discharges}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-5 text-[12px] text-[#777D87] pt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#16165c] inline-block" /> Daily Visits (Appointments & OPD)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#5350cc] inline-block" /> Admissions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#00b1ff] inline-block" /> Discharges
        </span>
      </div>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  sublabel?: string;
  color?: string;
}

export function HorizontalBarList({
  items,
  unit = '',
  prefix = '',
  emptyText = 'No records available.',
}: {
  items: BarDatum[];
  unit?: string;
  prefix?: string;
  emptyText?: string;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-[13px] text-[#777D87]">{emptyText}</p>;
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.min(100, Math.round((item.value / max) * 100));
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-[#202124] truncate">{item.label}</span>
              <span className="font-mono-tabular font-semibold text-[#202124] shrink-0">
                {prefix}
                {item.value.toLocaleString()}
                {unit ? ` ${unit}` : ''}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F1F3F6] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${item.value === 0 ? 0 : Math.max(4, pct)}%`,
                  backgroundColor: item.color || '#5350cc',
                }}
              />
            </div>
            {item.sublabel && <p className="text-[11px] text-[#777D87]">{item.sublabel}</p>}
          </div>
        );
      })}
    </div>
  );
}

export interface RevenuePeriodPoint {
  label: string;
  billed: number;
  collected: number;
}

export function RevenueBarChart({
  data,
  emptyText = 'No billing history in selected window.',
}: {
  data: RevenuePeriodPoint[];
  emptyText?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data.length) {
    return <p className="py-10 text-center text-[13px] text-[#777D87]">{emptyText}</p>;
  }

  const maxVal = Math.max(1000, ...data.map((d) => Math.max(d.billed, d.collected)));
  const w = 540;
  const h = 195;
  const padL = 52;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const groupW = chartW / data.length;
  const barW = Math.min(20, Math.max(8, groupW * 0.28));

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Billed vs Collected Revenue Chart">
          {yTicks.map((t) => {
            const y = padT + chartH - (t / maxVal) * chartH;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" strokeWidth="1" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#777D87" className="font-mono-tabular">
                  {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
                </text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const cx = padL + i * groupW + groupW / 2;
            const billedH = (d.billed / maxVal) * chartH;
            const collectedH = (d.collected / maxVal) * chartH;
            return (
              <g
                key={d.label}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <rect
                  x={cx - barW - 2}
                  y={padT + chartH - billedH}
                  width={barW}
                  height={Math.max(0, billedH)}
                  rx="3"
                  fill="#5350cc"
                  opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
                />
                <rect
                  x={cx + 2}
                  y={padT + chartH - collectedH}
                  width={barW}
                  height={Math.max(0, collectedH)}
                  rx="3"
                  fill="#00b1ff"
                  opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
                />
                <text x={cx} y={h - 6} textAnchor="middle" fontSize="11" fill="#777D87" className="font-mono-tabular">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div className="absolute top-1 right-2 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 shadow-sm text-[11px] pointer-events-none">
            <p className="font-semibold text-[#202124] mb-0.5">{hovered.label}</p>
            <p className="text-[#5350cc] font-mono-tabular">Billed: INR {hovered.billed.toLocaleString()}</p>
            <p className="text-[#0369A1] font-mono-tabular">Collected: INR {hovered.collected.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-5 text-[12px] text-[#777D87]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#5350cc] inline-block" /> Billed Revenue (INR)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#00b1ff] inline-block" /> Collected Revenue (INR)
        </span>
      </div>
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  unit = '',
  emptyText = 'No distribution data available.',
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string | number;
  unit?: string;
  emptyText?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-[13px] text-[#777D87]">{emptyText}</p>;
  }

  const r = 48;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 shrink-0">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90" role="img" aria-label={centerLabel}>
          <circle cx="64" cy="64" r={r} fill="none" stroke="#F1F3F6" strokeWidth="14" />
          {slices.map((slice) => {
            if (slice.value <= 0) return null;
            const dash = (slice.value / total) * circ;
            const currentOffset = offset;
            offset += dash;
            return (
              <circle
                key={slice.label}
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke={slice.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[11px] text-[#777D87]">{centerLabel}</span>
          <span className="text-[16px] font-semibold font-mono-tabular text-[#202124]">{centerValue}</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="inline-flex items-center gap-2 text-[#202124]">
              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: s.color }} />
              <span>{s.label}</span>
            </span>
            <span className="font-mono-tabular font-semibold text-[#202124]">
              {s.value.toLocaleString()}
              {unit ? ` ${unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
