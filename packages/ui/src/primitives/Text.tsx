import { createContext, forwardRef, useContext, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

import type { TokenName } from '../token';
import { tokenVar } from './space';
import './primitives.css';

const NestedText = createContext(false);

export type TextProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  as?: 'span' | 'p' | 'strong' | 'em' | 'div' | 'label' | 'small';
  children?: ReactNode;
  size?: 'small' | 'medium' | 'large';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  /** A text token (`text`, `text.muted`, `text.faint`, `text.danger`, `link`, …). */
  color?: TokenName;
  align?: 'start' | 'center' | 'end';
  /** Truncates with an ellipsis after this many lines. */
  maxLines?: number;
  testId?: string;
};

/** Body text in the platform's type scale. Nested texts inherit their parent's color and size. */
export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as = 'span', size, weight, color, align, maxLines, testId, className, style, children, ...rest },
  ref,
) {
  const nested = useContext(NestedText);
  const Element = as as ElementType;
  const classes = ['ui-text'];
  if (!nested || size) classes.push(`ui-text--${size ?? 'medium'}`);
  if (as === 'strong') classes.push('ui-text--w-bold');
  if (weight) classes.push(`ui-text--w-${weight}`);
  if (maxLines) classes.push('ui-text--clamp');
  if (className) classes.push(className);
  const textStyle: CSSProperties = {
    color: tokenVar(color ?? (nested ? undefined : 'text')),
    textAlign: align,
    ...(maxLines ? { WebkitLineClamp: maxLines } : {}),
    ...style,
  };
  return (
    <NestedText.Provider value>
      <Element ref={ref} className={classes.join(' ')} style={textStyle} data-testid={testId} {...rest}>
        {children}
      </Element>
    </NestedText.Provider>
  );
});

export type HeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, 'color'> & {
  size: 'xxlarge' | 'xlarge' | 'large' | 'medium' | 'small' | 'xsmall' | 'xxsmall';
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'span';
  color?: TokenName;
  children?: ReactNode;
  testId?: string;
};

const HEADING_ELEMENT: Record<HeadingProps['size'], NonNullable<HeadingProps['as']>> = {
  xxlarge: 'h1',
  xlarge: 'h1',
  large: 'h2',
  medium: 'h3',
  small: 'h4',
  xsmall: 'h5',
  xxsmall: 'h6',
};

/** Title in the platform's heading scale; the element follows the size unless `as` says otherwise. */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { size, as, color, testId, className, style, ...rest },
  ref,
) {
  const Element = (as ?? HEADING_ELEMENT[size]) as ElementType;
  return (
    <Element
      ref={ref}
      className={`ui-heading ui-heading--${size}${className ? ` ${className}` : ''}`}
      style={{ color: tokenVar(color ?? 'text'), ...style }}
      data-testid={testId}
      {...rest}
    />
  );
});
