import { Menu } from '@base-ui/react/menu';
import { useCallback, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react';

import './dropdown-menu.css';

const GAP = 8;

export type DropdownPlacement = 'bottom-start' | 'bottom' | 'bottom-end' | 'top-start' | 'top' | 'top-end';

export type DropdownTriggerState = { isOpen: boolean };

/** Props a custom trigger must spread on its button (they carry the ARIA attributes and the handlers). */
export type DropdownTriggerProps = HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> };

export type DropdownMenuProps = {
  /**
   * The button that opens the menu: an element that accepts a ref, or a function that receives the
   * trigger props and the open state (to show the trigger as selected while the menu is open).
   */
  trigger: ReactElement | ((props: DropdownTriggerProps, state: DropdownTriggerState) => ReactElement);
  /** Where the menu opens, relative to the trigger. */
  placement?: DropdownPlacement;
  /** Controlled open state; omit it to let the menu manage itself. */
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  children: ReactNode;
};

/**
 * The positioner snaps its position to device pixels, which moves a menu of fractional width (its
 * text sets the width) off the trigger's edge by a fraction of a pixel. Rounding the positioner's
 * width up and aligning the menu inside it keeps the menu edge exactly on the trigger edge.
 */
function useWholePixelBox() {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((popup: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    const positioner = popup?.parentElement;
    if (!popup || !positioner || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      positioner.style.minWidth = `${Math.ceil(popup.getBoundingClientRect().width)}px`;
    };
    observer.current = new ResizeObserver(fit);
    observer.current.observe(popup);
    fit();
  }, []);
}

function splitPlacement(placement: DropdownPlacement) {
  const [side, align] = placement.split('-') as ['top' | 'bottom', 'start' | 'end' | undefined];
  return { side, align: align ?? ('center' as const) };
}

/** A button that opens a list of actions or choices (keyboard: arrows, Home, End, typeahead, Escape). */
export function DropdownMenu({ trigger, placement = 'bottom-start', isOpen, onOpenChange, children }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isOpen ?? uncontrolledOpen;
  const { side, align } = splitPlacement(placement);
  const wholePixelBox = useWholePixelBox();

  return (
    <Menu.Root
      open={open}
      modal={false}
      onOpenChange={(next) => {
        setUncontrolledOpen(next);
        onOpenChange?.(next);
      }}
    >
      <Menu.Trigger
        render={
          typeof trigger === 'function'
            ? (props, state) => trigger(props as DropdownTriggerProps, { isOpen: state.open })
            : trigger
        }
      />
      <Menu.Portal>
        <Menu.Positioner className="ui-dropdown__positioner" side={side} align={align} sideOffset={GAP} collisionPadding={5}>
          <Menu.Popup ref={wholePixelBox} className="ui-dropdown">
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export type DropdownItemProps = {
  children: ReactNode;
  onClick?: () => void;
  /** Icon or avatar before the label. */
  elemBefore?: ReactNode;
  /** Content after the label (for example a shortcut or a count). */
  elemAfter?: ReactNode;
  /** Second line under the label. */
  description?: ReactNode;
  isDisabled?: boolean;
  /** Keeps the menu open after the click. */
  shouldStayOpen?: boolean;
};

function ItemContent({ before, children, description, after }: { before?: ReactNode; children: ReactNode; description?: ReactNode; after?: ReactNode }) {
  return (
    <span className="ui-dropdown__item-content">
      {before !== undefined && <span className="ui-dropdown__item-before">{before}</span>}
      <span className="ui-dropdown__item-text">
        <span className="ui-dropdown__item-label">{children}</span>
        {description !== undefined && <span className="ui-dropdown__item-description">{description}</span>}
      </span>
      {after !== undefined && <span className="ui-dropdown__item-after">{after}</span>}
    </span>
  );
}

/** One action of a `DropdownMenu`. */
export function DropdownItem({ children, onClick, elemBefore, elemAfter, description, isDisabled = false, shouldStayOpen = false }: DropdownItemProps) {
  return (
    <Menu.Item className="ui-dropdown__item" disabled={isDisabled} closeOnClick={!shouldStayOpen} {...(onClick ? { onClick } : {})}>
      <ItemContent before={elemBefore} description={description} after={elemAfter}>
        {children}
      </ItemContent>
    </Menu.Item>
  );
}

export type DropdownItemRadioGroupProps<Value extends string = string> = {
  /** Heading of the group, also its accessible name. */
  title: string;
  /** The checked option. */
  value: Value;
  onChange: (value: Value) => void;
  children: ReactNode;
};

/** A titled group of mutually exclusive options; render `DropdownItemRadio` children. */
export function DropdownItemRadioGroup<Value extends string = string>({ title, value, onChange, children }: DropdownItemRadioGroupProps<Value>) {
  return (
    <Menu.Group className="ui-dropdown__group">
      <Menu.GroupLabel className="ui-dropdown__group-title">{title}</Menu.GroupLabel>
      <Menu.RadioGroup value={value} onValueChange={(next: Value) => onChange(next)}>
        {children}
      </Menu.RadioGroup>
    </Menu.Group>
  );
}

export type DropdownItemRadioProps = {
  value: string;
  children: ReactNode;
  isDisabled?: boolean;
};

/** One option of a `DropdownItemRadioGroup`. The menu stays open after a choice, so the result is visible. */
export function DropdownItemRadio({ value, children, isDisabled = false }: DropdownItemRadioProps) {
  return (
    <Menu.RadioItem className="ui-dropdown__item ui-dropdown__item--radio" value={value} disabled={isDisabled} closeOnClick={false}>
      <ItemContent
        before={
          <svg className="ui-dropdown__radio" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle className="ui-dropdown__radio-ring" cx="12" cy="12" r="7.5" />
            <circle className="ui-dropdown__radio-dot" cx="12" cy="12" r="3" />
          </svg>
        }
      >
        {children}
      </ItemContent>
    </Menu.RadioItem>
  );
}
