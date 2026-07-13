import type { ReactNode } from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  formatter: (value: number) => string;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      <ul className="chart-tooltip-list">
        {payload.map((entry) => (
          <li key={String(entry.name)} className="chart-tooltip-row">
            <span
              className="chart-tooltip-dot"
              style={{ background: entry.color ?? 'var(--primary)' }}
            />
            <span className="chart-tooltip-name">{entry.name}</span>
            <span className="chart-tooltip-value">{formatter(Number(entry.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ChartLegendProps {
  items: Array<{ label: string; color: string }>;
}

export function ChartLegend({ items }: ChartLegendProps) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label} className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="chart-empty">
      <span className="chart-empty-dot" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export function ChartShell({
  title,
  subtitle,
  legend,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`chart-shell ${className ?? ''}`.trim()}>
      <div className="chart-shell-head">
        <div>
          <h3 className="chart-shell-title">{title}</h3>
          {subtitle && <p className="chart-shell-subtitle">{subtitle}</p>}
        </div>
        {legend}
      </div>
      {children}
    </div>
  );
}
