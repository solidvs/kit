/**
 * Platform icons. Systems import icons only from here; each glyph keeps a single meaning across the
 * platform (see the icon family README in the design system).
 */
import { createIcon } from './icons/Icon';

export type { IconProps } from './icons/Icon';

export const AddIcon = /* @__PURE__ */ createIcon('Add', 'AddIcon');
export const AngleBracketsIcon = /* @__PURE__ */ createIcon('AngleBrackets', 'AngleBracketsIcon');
export const AppSwitcherIcon = /* @__PURE__ */ createIcon('AppSwitcher', 'AppSwitcherIcon');
export const AutomationIcon = /* @__PURE__ */ createIcon('Automation', 'AutomationIcon');
export const BoardIcon = /* @__PURE__ */ createIcon('Board', 'BoardIcon');
export const BugIcon = /* @__PURE__ */ createIcon('Bug', 'BugIcon');
export const CalendarIcon = /* @__PURE__ */ createIcon('Calendar', 'CalendarIcon');
export const ChartBarIcon = /* @__PURE__ */ createIcon('ChartBar', 'ChartBarIcon');
export const ChevronDownIcon = /* @__PURE__ */ createIcon('ChevronDown', 'ChevronDownIcon');
export const ChevronRightIcon = /* @__PURE__ */ createIcon('ChevronRight', 'ChevronRightIcon');
export const CodeFolderIcon = /* @__PURE__ */ createIcon('CodeFolder', 'CodeFolderIcon');
export const ClockIcon = /* @__PURE__ */ createIcon('Clock', 'ClockIcon');
export const DashboardIcon = /* @__PURE__ */ createIcon('Dashboard', 'DashboardIcon');
export const DecisionIcon = /* @__PURE__ */ createIcon('Decision', 'DecisionIcon');
export const DeploymentIcon = /* @__PURE__ */ createIcon('Deployment', 'DeploymentIcon');
export const DatabaseIcon = /* @__PURE__ */ createIcon('Database', 'DatabaseIcon');
export const FilterIcon = /* @__PURE__ */ createIcon('Filter', 'FilterIcon');
export const FolderIcon = /* @__PURE__ */ createIcon('Folder', 'FolderIcon');
export const FullscreenEnterIcon = /* @__PURE__ */ createIcon('FullscreenEnter', 'FullscreenEnterIcon');
export const GlobeIcon = /* @__PURE__ */ createIcon('Globe', 'GlobeIcon');
export const HomeIcon = /* @__PURE__ */ createIcon('Home', 'HomeIcon');
export const InboxIcon = /* @__PURE__ */ createIcon('Inbox', 'InboxIcon');
export const LayersIcon = /* @__PURE__ */ createIcon('Layers', 'LayersIcon');
export const MindMapIcon = /* @__PURE__ */ createIcon('MindMap', 'MindMapIcon');
export const LinkIcon = /* @__PURE__ */ createIcon('Link', 'LinkIcon');
export const ListBulletedIcon = /* @__PURE__ */ createIcon('ListBulleted', 'ListBulletedIcon');
export const NetworkIcon = /* @__PURE__ */ createIcon('Network', 'NetworkIcon');
export const NotificationIcon = /* @__PURE__ */ createIcon('Notification', 'NotificationIcon');
export const PageIcon = /* @__PURE__ */ createIcon('Page', 'PageIcon');
export const PersonIcon = /* @__PURE__ */ createIcon('Person', 'PersonIcon');
export const PriorityHighIcon = /* @__PURE__ */ createIcon('PriorityHigh', 'PriorityHighIcon');
export const PriorityLowIcon = /* @__PURE__ */ createIcon('PriorityLow', 'PriorityLowIcon');
export const PriorityMediumIcon = /* @__PURE__ */ createIcon('PriorityMedium', 'PriorityMediumIcon');
export const ScreenIcon = /* @__PURE__ */ createIcon('Screen', 'ScreenIcon');
export const QuestionCircleIcon = /* @__PURE__ */ createIcon('QuestionCircle', 'QuestionCircleIcon');
export const SearchIcon = /* @__PURE__ */ createIcon('Search', 'SearchIcon');
export const SettingsIcon = /* @__PURE__ */ createIcon('Settings', 'SettingsIcon');
export const ShareIcon = /* @__PURE__ */ createIcon('Share', 'ShareIcon');
export const ShowMoreHorizontalIcon = /* @__PURE__ */ createIcon('ShowMoreHorizontal', 'ShowMoreHorizontalIcon');
export const StarUnstarredIcon = /* @__PURE__ */ createIcon('StarUnstarred', 'StarUnstarredIcon');
export const StoryIcon = /* @__PURE__ */ createIcon('Story', 'StoryIcon');
export const TaskIcon = /* @__PURE__ */ createIcon('Task', 'TaskIcon');
export const ThemeIcon = /* @__PURE__ */ createIcon('Theme', 'ThemeIcon');
export const TimelineIcon = /* @__PURE__ */ createIcon('Timeline', 'TimelineIcon');
export const UserFolderIcon = /* @__PURE__ */ createIcon('UserFolder', 'UserFolderIcon');

/** @deprecated Renamed to `FolderIcon` (folder glyphs are named by use). Removed in 0.5.0. */
export const ProjectIcon = FolderIcon;
/** @deprecated Renamed to `CodeFolderIcon` (folder glyphs are named by use). Removed in 0.5.0. */
export const RepositoryIcon = CodeFolderIcon;
