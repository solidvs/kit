import type { HTMLAttributes, ReactNode } from 'react';

import './badge.css';

export type BadgeAppearance = 'default' | 'primary' | 'important' | 'added' | 'removed';

export type BadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  appearance?: BadgeAppearance;
  /** A count or a short text. Counts above `max` show as `max+`. */
  children?: number | string | ReactNode;
  /** Largest count shown as is; `false` disables the cap. */
  max?: number | false;
  testId?: string;
};

function format(children: BadgeProps['children'], max: number | false) {
  if (typeof children !== 'number') return children;
  if (max !== false && children > max) return `${max}+`;
  return String(children);
}

/** Small count or status tag, such as the number of unread notifications. */
export function Badge({ appearance = 'default', max = 99, testId, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={['ui-badge', `ui-badge--${appearance}`, className].filter(Boolean).join(' ')}
      data-testid={testId}
      {...rest}
    >
      <span className="ui-badge__label">{format(children, max)}</span>
    </span>
  );
}
