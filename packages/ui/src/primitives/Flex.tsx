import { forwardRef, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

import type { Space } from '../token';
import { spaceVar } from './space';
import './primitives.css';

type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

type FlexBaseProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  as?: ElementType;
  children?: ReactNode;
  space?: Space;
  alignBlock?: Align;
  alignInline?: Align;
  spread?: 'space-between';
  grow?: 'hug' | 'fill';
  testId?: string;
};

export type InlineProps = FlexBaseProps & {
  rowSpace?: Space;
  shouldWrap?: boolean;
};

export type StackProps = FlexBaseProps;

const ALIGN: Record<Align, string> = { start: 'start', center: 'center', end: 'end', stretch: 'stretch', baseline: 'baseline' };

/** Lays children out in a row, `space` apart; items align to the start of the cross axis by default. */
export const Inline = forwardRef<HTMLElement, InlineProps>(function Inline(
  { as: Element = 'div', space, rowSpace, alignBlock = 'start', alignInline, spread, shouldWrap, grow, testId, className, style, ...rest },
  ref,
) {
  const flexStyle: CSSProperties = {
    columnGap: spaceVar(space),
    rowGap: spaceVar(rowSpace ?? space),
    alignItems: ALIGN[alignBlock],
    justifyContent: spread ?? (alignInline ? ALIGN[alignInline] : undefined),
    flexWrap: shouldWrap ? 'wrap' : undefined,
    width: grow === 'fill' ? '100%' : undefined,
    ...style,
  };
  return <Element ref={ref} className={className ? `ui-inline ${className}` : 'ui-inline'} style={flexStyle} data-testid={testId} {...rest} />;
});

/** Lays children out in a column, `space` apart. */
export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { as: Element = 'div', space, alignBlock, alignInline, spread, grow, testId, className, style, ...rest },
  ref,
) {
  const flexStyle: CSSProperties = {
    rowGap: spaceVar(space),
    alignItems: alignInline ? ALIGN[alignInline] : undefined,
    justifyContent: spread ?? (alignBlock ? ALIGN[alignBlock] : undefined),
    height: grow === 'fill' ? '100%' : undefined,
    ...style,
  };
  return <Element ref={ref} className={className ? `ui-stack ${className}` : 'ui-stack'} style={flexStyle} data-testid={testId} {...rest} />;
});
