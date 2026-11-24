import { forwardRef, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

import type { Space, TokenName } from '../token';
import { spaceVar, tokenVar } from './space';
import './primitives.css';

export type BoxProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  as?: ElementType;
  children?: ReactNode;
  padding?: Space;
  paddingBlock?: Space;
  paddingBlockStart?: Space;
  paddingBlockEnd?: Space;
  paddingInline?: Space;
  paddingInlineStart?: Space;
  paddingInlineEnd?: Space;
  backgroundColor?: TokenName;
  testId?: string;
};

/** Generic container with token-based padding and background; renders a `div` by default. */
export const Box = forwardRef<HTMLElement, BoxProps>(function Box(
  {
    as: Element = 'div',
    padding,
    paddingBlock,
    paddingBlockStart,
    paddingBlockEnd,
    paddingInline,
    paddingInlineStart,
    paddingInlineEnd,
    backgroundColor,
    testId,
    className,
    style,
    ...rest
  },
  ref,
) {
  const blockStart = paddingBlockStart ?? paddingBlock ?? padding;
  const blockEnd = paddingBlockEnd ?? paddingBlock ?? padding;
  const inlineStart = paddingInlineStart ?? paddingInline ?? padding;
  const inlineEnd = paddingInlineEnd ?? paddingInline ?? padding;
  const boxStyle: CSSProperties = {
    paddingBlockStart: spaceVar(blockStart),
    paddingBlockEnd: spaceVar(blockEnd),
    paddingInlineStart: spaceVar(inlineStart),
    paddingInlineEnd: spaceVar(inlineEnd),
    backgroundColor: tokenVar(backgroundColor),
    ...style,
  };
  return (
    <Element
      ref={ref}
      className={className ? `ui-box ${className}` : 'ui-box'}
      style={boxStyle}
      data-testid={testId}
      {...rest}
    />
  );
});
