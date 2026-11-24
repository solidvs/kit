import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import './lozenge.css';

export type LozengeAppearance = 'default' | 'inprogress' | 'moved' | 'new' | 'removed' | 'success';

export type LozengeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  appearance?: LozengeAppearance;
  /**
   * Accepted for compatibility with 0.1.x, where the bold variant rendered exactly like the
   * subtle one. Kept identical on purpose so screens do not change.
   */
  isBold?: boolean;
  /** Maximum width, in pixels or any CSS length; longer text is truncated with an ellipsis. */
  maxWidth?: number | string;
  testId?: string;
  children?: ReactNode;
};

/** Short status label (for example "Em andamento") drawn as a tinted, bordered tag. */
export function Lozenge({
  appearance = 'default',
  isBold = false,
  maxWidth = 200,
  testId,
  className,
  style,
  children,
  ...rest
}: LozengeProps) {
  const max = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  return (
    <span
      className={['ui-lozenge', `ui-lozenge--${appearance}`, className].filter(Boolean).join(' ')}
      data-bold={isBold || undefined}
      data-testid={testId}
      style={{ '--ui-lozenge-max-width': max, ...style } as CSSProperties}
      {...rest}
    >
      <span className="ui-lozenge__content">
        <span className="ui-lozenge__text">{children}</span>
      </span>
    </span>
  );
}
