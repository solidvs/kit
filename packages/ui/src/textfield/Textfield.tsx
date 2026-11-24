import { Input } from '@base-ui/react/input';
import { forwardRef, useRef, type ChangeEventHandler, type InputHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

import './textfield.css';

export type TextfieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'disabled' | 'children'> & {
  /** 32px tall instead of 40px. */
  isCompact?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  /** Content before the text, such as a search icon; it does not take focus. */
  elemBeforeInput?: ReactNode;
  /** Content after the text. */
  elemAfterInput?: ReactNode;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  testId?: string;
};

/** Single-line text input. Clicking anywhere in the field focuses the text. */
export const Textfield = forwardRef<HTMLInputElement, TextfieldProps>(function Textfield(
  { isCompact = false, isDisabled = false, isInvalid = false, elemBeforeInput, elemAfterInput, testId, className, ...inputProps },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const focusInput = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === inputRef.current || isDisabled) return;
    event.preventDefault();
    inputRef.current?.focus();
  };
  const classes = [
    'ui-textfield',
    isCompact ? 'ui-textfield--compact' : '',
    isDisabled ? 'ui-textfield--disabled' : '',
    isInvalid ? 'ui-textfield--invalid' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} role="presentation" onMouseDown={focusInput} data-testid={testId && `${testId}-container`}>
      {elemBeforeInput}
      <Input
        ref={(node: HTMLElement | null) => {
          inputRef.current = node as HTMLInputElement | null;
          if (typeof ref === 'function') ref(node as HTMLInputElement | null);
          else if (ref) ref.current = node as HTMLInputElement | null;
        }}
        className="ui-textfield__input"
        disabled={isDisabled}
        aria-invalid={isInvalid || undefined}
        data-testid={testId}
        {...inputProps}
      />
      {elemAfterInput}
    </div>
  );
});
