import type { LucideIcon } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { clsx } from '../../lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  variant?: 'default' | 'income' | 'expense' | 'balance';
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  variant = 'default',
}: StatCardProps) {
  const { formatDisplay } = useCurrency();

  return (
    <div className={clsx('stat-card', `stat-card-${variant}`)}>
      <div className="stat-card-content">
        <span className="stat-card-title">{title}</span>
        <span
          className={clsx(
            'stat-card-value',
            trend === 'up' && 'text-success',
            trend === 'down' && 'text-danger',
          )}
        >
          {formatDisplay(value)}
        </span>
        {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
      </div>
      <div className="stat-card-icon">
        <Icon size={24} />
      </div>
    </div>
  );
}
