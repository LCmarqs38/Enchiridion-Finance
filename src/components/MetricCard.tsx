import { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

type Props = {
  label: string;
  value: number;
  variant?: 'default' | 'positive' | 'negative' | 'accent';
  icon?: LucideIcon;
  className?: string;
};

const colorMap = {
  default: 'text-white',
  positive: 'text-emerald-500',
  negative: 'text-rose-500',
  accent: 'text-blue-400',
};

export default function MetricCard({ label, value, variant = 'default', icon: Icon, className = '' }: Props) {
  return (
    <div className={`card p-3 sm:p-4 flex flex-col justify-between ${className}`}>
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-normal leading-tight">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />}
      </div>
      <span className={`mt-1.5 text-lg sm:text-xl font-semibold tabular-nums leading-tight ${colorMap[variant]}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
