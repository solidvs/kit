import { Popover } from '@base-ui/react/popover';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';

import { Avatar } from '../avatar/Avatar';
import { Badge } from '../badge/Badge';
import { Button, IconButton } from '../button/Button';
import { Glyph, createIcon } from '../icons/Icon';
import {
  AddIcon,
  AppSwitcherIcon,
  NotificationIcon,
  QuestionCircleIcon,
  SearchIcon,
  SettingsIcon,
  ShowMoreHorizontalIcon,
  ThemeIcon,
} from '../icons';
import { DropdownItemRadio, DropdownItemRadioGroup, DropdownMenu, type DropdownTriggerProps } from '../menu/DropdownMenu';
import { useColorMode, type ColorMode } from '../theme/PlatformProvider';
import { Tooltip, TooltipGroup } from '../tooltip/Tooltip';
import { PlatformIcon, PlatformLogo } from './PlatformLogo';
import './app-shell.css';

export type AppShellProps = {
  /** Side nav content, composed from `SideNavMenu`, `ProjectsMenuItem` and `NavMenuItem`. */
  sideNav: ReactNode;
  /** Optional fixed bottom of the side nav. */
  sideNavFooter?: ReactNode;
  /** Home of the system, target of the logo. */
  homeHref?: string;
  onCreate?: () => void;
  onSearch?: () => void;
  notificationCount?: number;
  userName: string;
  /** Rendered only for administrators. */
  showSettings?: boolean;
  onSettings?: () => void;
  children: ReactNode;
};

const COLOR_MODE_LABELS: Record<ColorMode, string> = { light: 'Claro', dark: 'Escuro', auto: 'Igual ao sistema' };
const COLOR_MODES = Object.keys(COLOR_MODE_LABELS) as ColorMode[];

const SidebarCollapseIcon = createIcon('SidebarCollapse', 'SidebarCollapseIcon');
const SidebarExpandIcon = createIcon('SidebarExpand', 'SidebarExpandIcon');

/** Wide screens keep the side nav beside the content; narrower ones open it over the content. */
const WIDE_QUERY = '(min-width: 1024px)';

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * Application shell of every platform system: a 48 px top nav, a 320 px side nav that collapses
 * (button or Ctrl+[) and the main area. Below 1024 px the side nav opens over the content.
 */
export function AppShell({
  sideNav,
  sideNavFooter,
  homeHref = '/',
  onCreate,
  onSearch,
  notificationCount = 0,
  userName,
  showSettings = false,
  onSettings,
  children,
}: AppShellProps) {
  const ids = { top: useId(), side: useId(), main: useId() };
  const isWide = useMediaQuery(WIDE_QUERY);
  const [isExpanded, setExpanded] = useState(true);
  const [isFlyoutOpen, setFlyoutOpen] = useState(false);
  const sideNavVisible = isWide ? isExpanded : isFlyoutOpen;
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => {
    if (isWide) setExpanded((value) => !value);
    else setFlyoutOpen((value) => !value);
  }, [isWide]);

  // Ctrl+[ toggles the side nav, except while typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key !== '[' && event.code !== 'BracketLeft') return;
      if (isEditable(event.target)) return;
      event.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  // The flyout closes on a click outside it and on Escape.
  useEffect(() => {
    if (isWide || !isFlyoutOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (navRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setFlyoutOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFlyoutOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isWide, isFlyoutOpen]);

  const toggleLabel = sideNavVisible ? 'Recolher barra lateral' : 'Expandir barra lateral';

  const endItems = (
    <div role="list" className="ui-topnav__actions">
      <div role="listitem" className="ui-topnav__action ui-topnav__action--notifications">
        <Tooltip content="Notificações">
          <IconButton
            icon={NotificationIcon}
            label={notificationCount > 0 ? `Notificações (${notificationCount})` : 'Notificações'}
            appearance="subtle"
          />
        </Tooltip>
        {notificationCount > 0 && (
          <div className="ui-topnav__badge" aria-hidden="true">
            <Badge appearance="important">{notificationCount}</Badge>
          </div>
        )}
      </div>
      <div role="listitem" className="ui-topnav__action">
        <Tooltip content="Ajuda">
          <IconButton icon={QuestionCircleIcon} label="Ajuda" appearance="subtle" />
        </Tooltip>
      </div>
      {showSettings && (
        <div role="listitem" className="ui-topnav__action">
          <Tooltip content="Configurações">
            <IconButton icon={SettingsIcon} label="Configurações" appearance="subtle" {...(onSettings ? { onClick: onSettings } : {})} />
          </Tooltip>
        </div>
      )}
      <div role="listitem" className="ui-topnav__action">
        <ThemeMenu />
      </div>
      <div role="listitem" className="ui-topnav__action">
        <Tooltip content={`Perfil de ${userName}`}>
          <IconButton icon={ProfileAvatar} label={`Perfil de ${userName}`} appearance="subtle" />
        </Tooltip>
      </div>
    </div>
  );

  return (
    <TooltipGroup>
      <SkipLinks
        links={[
          { id: ids.top, label: 'Top Bar' },
          ...(sideNavVisible ? [{ id: ids.side, label: 'Barra lateral' }] : []),
          { id: ids.main, label: 'Main Content' },
        ]}
      />
      <div
        className="ui-shell"
        data-layout={isWide ? 'wide' : 'narrow'}
        data-side-nav={sideNavVisible ? 'expanded' : 'collapsed'}
      >
        <header id={ids.top} className="ui-topnav" tabIndex={-1}>
          <div className="ui-topnav__start">
            <Tooltip content={toggleLabel} shortcut={['Ctrl', '[']}>
              <IconButton
                ref={toggleRef}
                icon={sideNavVisible ? SidebarCollapseIcon : SidebarExpandIcon}
                label={toggleLabel}
                appearance="subtle"
                aria-expanded={sideNavVisible}
                aria-controls={ids.side}
                onClick={toggle}
              />
            </Tooltip>
            <Tooltip content="Trocar de aplicação">
              <IconButton icon={AppSwitcherIcon} label="Trocar de aplicação" appearance="subtle" />
            </Tooltip>
            <a className="ui-topnav__logo" href={homeHref} aria-label="Plataforma — início">
              <span className="ui-topnav__logo-inner">
                <span className="ui-topnav__logo-full">
                  <PlatformLogo />
                </span>
                <span className="ui-topnav__logo-icon">
                  <PlatformIcon />
                </span>
              </span>
            </a>
          </div>
          <div className={`ui-topnav__middle${onCreate ? ' ui-topnav__middle--create' : ''}`}>
            <SearchField {...(onSearch ? { onClick: onSearch } : {})} />
            <span className="ui-topnav__search-compact">
              <Tooltip content="Pesquisar">
                <IconButton icon={SearchIcon} label="Pesquisar" appearance="subtle" {...(onSearch ? { onClick: onSearch } : {})} />
              </Tooltip>
            </span>
            {onCreate && (
              <Button appearance="primary" iconBefore={AddIcon} onClick={onCreate}>
                Criar
              </Button>
            )}
          </div>
          <nav className="ui-topnav__end" aria-label="Ações">
            {endItems}
            <MoreActions>{endItems}</MoreActions>
          </nav>
        </header>

        <nav id={ids.side} ref={navRef} className="ui-sidenav" aria-label="Barra lateral" tabIndex={-1}>
          <div className="ui-sidenav__inner">
            <div className="ui-sidenav__body">
              <div className="ui-sidenav__content">{sideNav}</div>
            </div>
            <div className="ui-sidenav__footer">{sideNavFooter}</div>
          </div>
        </nav>

        <main id={ids.main} className="ui-shell__main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </TooltipGroup>
  );
}

/** "Pular para" panel: hidden until it receives keyboard focus, then jumps to a region of the page. */
function SkipLinks({ links }: { links: { id: string; label: string }[] }) {
  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    document.getElementById(id)?.focus();
  };
  return (
    <div className="ui-skip-links">
      <span className="ui-skip-links__title">Pular para</span>
      <ol className="ui-skip-links__list">
        {links.map((link) => (
          <li key={link.id}>
            <a className="ui-skip-links__link" href={`#${link.id}`} onClick={(event) => jump(event, link.id)}>
              {link.label}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Button that looks like a search field and opens the system's search. */
function SearchField(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="ui-topnav__search" {...props}>
      <span className="ui-topnav__search-icon">
        <Glyph glyph="Search" label="" viewBox="-4 -4 24 24" pixelSize={24} />
      </span>
      <span className="ui-topnav__search-text">Pesquisar</span>
    </button>
  );
}

function ProfileAvatar() {
  return <Avatar size="small" />;
}

/** Below 768 px the actions at the end of the top nav move into this popup. */
function MoreActions({ children }: { children: ReactNode }) {
  return (
    <span className="ui-topnav__more">
      <Popover.Root>
        <Popover.Trigger render={<IconButton icon={ShowMoreHorizontalIcon} label="Mostrar mais" appearance="subtle" />} />
        <Popover.Portal>
          <Popover.Positioner className="ui-topnav__more-positioner" side="bottom" align="end" sideOffset={8} collisionPadding={5}>
            <Popover.Popup className="ui-topnav__more-popup">{children}</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}

function ThemeMenu() {
  const { colorMode, resolvedColorMode, setColorMode } = useColorMode();
  return (
    <DropdownMenu
      placement="bottom-end"
      trigger={(props: DropdownTriggerProps, { isOpen }) => (
        <IconButton
          {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
          ref={props.ref as Ref<HTMLButtonElement>}
          aria-pressed={undefined}
          icon={ThemeIcon}
          label="Tema"
          appearance="subtle"
          isSelected={isOpen}
        />
      )}
    >
      <DropdownItemRadioGroup title={`Tema (atual: ${COLOR_MODE_LABELS[resolvedColorMode]})`} value={colorMode} onChange={setColorMode}>
        {COLOR_MODES.map((mode) => (
          <DropdownItemRadio key={mode} value={mode}>
            {COLOR_MODE_LABELS[mode]}
          </DropdownItemRadio>
        ))}
      </DropdownItemRadioGroup>
    </DropdownMenu>
  );
}
