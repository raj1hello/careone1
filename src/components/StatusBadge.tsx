import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  variant?: 'light' | 'observatory' | 'hospital';
}

export function StatusBadge({ status, variant = 'light' }: StatusBadgeProps) {
  const norm = (status || '').toLowerCase();
  const isObs = variant === 'observatory';
  const isHosp = variant === 'hospital';

  if (
    [
      'verified',
      'accepted',
      'completed',
      'available',
      'paid',
      'delivered',
      'resolved',
      'active',
      'dispensed',
      'operational',
      'discharged',
    ].includes(norm)
  ) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 ${
          isHosp
            ? 'px-2 py-0.5 rounded-md bg-[#ECFDF3] text-[#067647]'
            : isObs
              ? 'text-[#00ffaa]'
              : 'text-[#15803d]'
        }`}
      >
        {!isHosp && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
        <span className="capitalize">{norm.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  if (
    [
      'pending',
      'scheduled',
      'preparing',
      'rescheduled',
      'reserved',
      'requested',
      'in_person',
      'in_use',
      'admitted',
    ].includes(norm)
  ) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 ${
          isHosp
            ? 'px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1]'
            : isObs
              ? 'text-[#00b1ff]'
              : 'text-[#0071e3]'
        }`}
      >
        {!isHosp && <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
        <span className="capitalize">{norm.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  if (['dispatched', 'en_route', 'arrived', 'occupied', 'video', 'high', 'maintenance', 'moderate'].includes(norm)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 ${
          isHosp
            ? 'px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309]'
            : isObs
              ? 'text-[#fbbf24]'
              : 'text-[#b45309]'
        }`}
      >
        {!isHosp && <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
        <span className="capitalize">{norm.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  if (['rejected', 'cancelled', 'failed', 'critical', 'expired', 'unpaid', 'refunded'].includes(norm)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 ${
          isHosp
            ? 'px-2 py-0.5 rounded-md bg-[#FEE2E2] text-[#B91C1C]'
            : isObs
              ? 'text-[#ff6b6b]'
              : 'text-[#dc2626]'
        }`}
      >
        {!isHosp &&
          (norm === 'critical' ? (
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ))}
        <span className="capitalize">{norm.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 ${
        isHosp
          ? 'px-2 py-0.5 rounded-md bg-[#F1F3F6] text-[#777D87]'
          : isObs
            ? 'text-[#b0b3d6]'
            : 'text-[#6e6e73]'
      }`}
    >
      <span className="capitalize">{norm.replace(/_/g, ' ')}</span>
    </span>
  );
}
