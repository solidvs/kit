import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import './tabs.css';

export type TabsProps = {
  /** Id of the tabs element. */
  id?: string;
  /** Index of the selected tab (controlled). */
  selected?: number;
  /** Index of the tab selected first (uncontrolled). */
  defaultSelected?: number;
  /** Called with the index of the tab the person selects. */
  onChange?: (index: number) => void;
  /** A `TabList` followed by one `TabPanel` per tab, in the same order. */
  children: ReactNode;
  testId?: string;
};

export type TabListProps = {
  children: ReactNode;
  /** Accessible name of the list, when the page has more than one. */
  'aria-label'?: string;
};

export type TabProps = {
  children: ReactNode;
  isDisabled?: boolean;
  testId?: string;
  /** Position of the tab; set by `TabList`, never by the caller. */
  value?: number;
};

export type TabPanelProps = {
  children: ReactNode;
  testId?: string;
  /** Position of the panel; set by `Tabs`, never by the caller. */
  value?: number;
};

const SelectedTab = createContext(0);

/** Gives each child of the given type its position, counting only children of that type. */
function withPositions(children: ReactNode, type: unknown): ReactNode {
  let position = 0;
  return Children.map(children, (child) => {
    if (!isValidElement(child) || child.type !== type) return child;
    return cloneElement(child as ReactElement<{ value?: number }>, { value: position++ });
  });
}

/**
 * Tabs that switch between views of the same page. Arrow keys move between tabs and select them;
 * `selected` and `onChange` work by index, in the order of the `Tab` and `TabPanel` children.
 */
export function Tabs({ id, selected, defaultSelected = 0, onChange, children, testId }: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultSelected);
  const current = selected ?? uncontrolled;
  return (
    <SelectedTab.Provider value={current}>
      <BaseTabs.Root
        id={id}
        className="ui-tabs"
        value={current}
        onValueChange={(value: number) => {
          if (selected === undefined) setUncontrolled(value);
          onChange?.(value);
        }}
        data-testid={testId}
      >
        {withPositions(children, TabPanel)}
      </BaseTabs.Root>
    </SelectedTab.Provider>
  );
}

/** Row of tabs; its children are `Tab` elements. */
export function TabList({ children, 'aria-label': label }: TabListProps) {
  return (
    <BaseTabs.List className="ui-tabs__list" activateOnFocus aria-label={label}>
      {withPositions(children, Tab)}
    </BaseTabs.List>
  );
}

/** One tab. Its content is usually an icon and a label, laid out by the caller. */
export function Tab({ children, isDisabled, testId, value = 0 }: TabProps) {
  return (
    <BaseTabs.Tab className="ui-tabs__tab" value={value} disabled={isDisabled} data-testid={testId}>
      <span className="ui-tabs__tab-label">{children}</span>
    </BaseTabs.Tab>
  );
}

/**
 * Content of one tab. A panel mounts the first time its tab is selected and then stays mounted,
 * hidden, so its state survives switching tabs.
 */
export function TabPanel({ children, testId, value = 0 }: TabPanelProps) {
  const selected = useContext(SelectedTab);
  const [visited, setVisited] = useState(selected === value);
  if (selected === value && !visited) setVisited(true);
  return (
    <BaseTabs.Panel className="ui-tabs__panel" value={value} keepMounted={visited} data-testid={testId}>
      {children}
    </BaseTabs.Panel>
  );
}
