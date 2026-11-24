import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

import './tooltip.css';

/** Hover delay before a tooltip opens. Once one is open, moving to another trigger shows its tooltip at once. */
const OPEN_DELAY = 300;
const CLOSE_DELAY = 300;
const GAP = 8;

export type TooltipProps = {
  /** Text shown in the tooltip. */
  content: ReactNode;
  /** Side of the trigger where the tooltip appears. */
  position?: 'top' | 'right' | 'bottom' | 'left';
  /** Keys of the action's keyboard shortcut, shown under the text (for example `['Ctrl', '[']`). */
  shortcut?: string[];
  /** The trigger: a single element that accepts a ref (a button or a link). */
  children: ReactElement;
};

/** Short text label shown on hover or keyboard focus of its trigger. */
export function Tooltip({ content, position = 'bottom', shortcut, children }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={OPEN_DELAY} closeDelay={CLOSE_DELAY} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          className="ui-tooltip__positioner"
          side={position}
          sideOffset={GAP}
          collisionPadding={5}
        >
          <BaseTooltip.Popup className="ui-tooltip" role="tooltip">
            {content}
            {shortcut && shortcut.length > 0 && (
              <span className="ui-tooltip__shortcut">
                {shortcut.map((key) => (
                  <kbd key={key} className="ui-tooltip__key">
                    {key}
                  </kbd>
                ))}
              </span>
            )}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

/** Shares the delay among the tooltips inside it, so moving from one trigger to the next is instant. */
export function TooltipGroup({ children }: { children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={OPEN_DELAY} closeDelay={CLOSE_DELAY}>
      {children}
    </BaseTooltip.Provider>
  );
}
