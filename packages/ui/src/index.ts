/**
 * @solidvs/ui — the platform's single UI entry point (ADR-0011).
 *
 * Platform code only: behavior from Base UI and dnd-kit (MIT), fonts Inter and JetBrains Mono
 * (SIL OFL 1.1, see NOTICE). Systems import from here only.
 */
export { PlatformProvider, useColorMode, type ColorMode } from './theme/PlatformProvider';
export { token, type Space, type TokenName } from './token';
export { Box, type BoxProps } from './primitives/Box';
export { Inline, Stack, type InlineProps, type StackProps } from './primitives/Flex';
export { Heading, Text, type HeadingProps, type TextProps } from './primitives/Text';
export { Button, IconButton, type ButtonAppearance, type ButtonProps, type IconButtonProps } from './button/Button';
export { Lozenge, type LozengeProps } from './lozenge/Lozenge';
export { Badge, type BadgeProps } from './badge/Badge';
export { Avatar, type AvatarProps } from './avatar/Avatar';
export { AvatarGroup, type AvatarGroupProps } from './avatar/AvatarGroup';
export { Tooltip, TooltipGroup, type TooltipProps } from './tooltip/Tooltip';
export {
  DropdownMenu,
  DropdownItem,
  DropdownItemRadio,
  DropdownItemRadioGroup,
  type DropdownItemProps,
  type DropdownItemRadioGroupProps,
  type DropdownItemRadioProps,
  type DropdownMenuProps,
  type DropdownPlacement,
} from './menu/DropdownMenu';
export { Tabs, TabList, Tab, TabPanel, type TabsProps, type TabListProps, type TabProps, type TabPanelProps } from './tabs/Tabs';
export { Breadcrumbs, BreadcrumbsItem, type BreadcrumbsProps, type BreadcrumbsItemProps } from './breadcrumbs/Breadcrumbs';
export { Textfield, type TextfieldProps } from './textfield/Textfield';
export { AppShell, type AppShellProps } from './shell/AppShell';
export {
  NavMenuItem,
  ProjectsMenuItem,
  SideNavMenu,
  type Navigate,
  type NavItem,
  type NavSection,
  type ProjectLink,
  type ProjectsMenuItemProps,
} from './shell/side-nav';
export { ProjectPage, type ProjectPageProps, type ProjectView } from './page/ProjectPage';
export { Board, type BoardProps } from './board/Board';
export { moveCard, type CardMove } from './board/move-card';
export type { BoardCardData, BoardColumnData, Priority, WorkType } from './board/types';
export * from './icons';
