import { cloneElement, isValidElement, useId, type ReactElement } from 'react';
import { clsx } from '../../lib/utils';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  label: string;
  side?: TooltipSide;
  children: ReactElement<{ 'aria-label'?: string; 'aria-describedby'?: string }>;
}

export function Tooltip({ label, side = 'top', children }: TooltipProps) {
  const id = useId();

  const child = isValidElement(children)
    ? cloneElement(children, {
        'aria-label': children.props['aria-label'] ?? label,
        'aria-describedby': id,
      })
    : children;

  return (
    <span className={clsx('tooltip-anchor', `tooltip-side-${side}`)}>
      {child}
      <span id={id} className="tooltip-bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
}
