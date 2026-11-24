import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';

import type { IconProps } from '../icons/Icon';
import './button.css';

export type ButtonAppearance = 'default' | 'primary' | 'subtle' | 'warning' | 'danger' | 'discovery';

type CommonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled'> & {
  appearance?: ButtonAppearance;
  spacing?: 'default' | 'compact';
  isDisabled?: boolean;
  isSelected?: boolean;
  testId?: string;
};

export type ButtonProps = CommonProps & {
  children: ReactNode;
  iconBefore?: ComponentType<IconProps>;
  iconAfter?: ComponentType<IconProps>;
  shouldFitContainer?: boolean;
};

function classes(base: string, appearance: ButtonAppearance, spacing: string, isSelected: boolean, extra?: string) {
  return [
    'ui-button',
    base,
    `ui-button--${isSelected ? 'selected' : appearance}`,
    spacing === 'compact' ? 'ui-button--compact' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Text button; icons are decorative because the label already names the action. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    appearance = 'default',
    spacing = 'default',
    isDisabled = false,
    isSelected = false,
    iconBefore: IconBefore,
    iconAfter: IconAfter,
    shouldFitContainer,
    testId,
    className,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-pressed={isSelected || undefined}
      data-testid={testId}
      className={classes(
        IconBefore || IconAfter ? 'ui-button--with-icon' : '',
        appearance,
        spacing,
        isSelected,
        [shouldFitContainer ? 'ui-button--fit' : '', className ?? ''].join(' ').trim(),
      )}
      {...rest}
    >
      {IconBefore && (
        <span className="ui-button__icon">
          <IconBefore label="" />
        </span>
      )}
      <span className="ui-button__label">{children}</span>
      {IconAfter && (
        <span className="ui-button__icon">
          <IconAfter label="" />
        </span>
      )}
    </button>
  );
});

export type IconButtonProps = CommonProps & {
  icon: ComponentType<IconProps>;
  /** Accessible name; also shown as the tooltip text when the caller adds one. */
  label: string;
  shape?: 'default' | 'circle';
};

/** Square button that shows only an icon; `label` is its accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, appearance = 'default', spacing = 'default', shape = 'default', isDisabled = false, isSelected = false, testId, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-pressed={isSelected || undefined}
      data-testid={testId}
      className={classes('ui-icon-button', appearance, spacing, isSelected, [shape === 'circle' ? 'ui-button--circle' : '', className ?? ''].join(' ').trim())}
      {...rest}
    >
      <span className="ui-button__icon">
        <Icon label="" />
      </span>
      <span className="ui-visually-hidden">{label}</span>
    </button>
  );
});
