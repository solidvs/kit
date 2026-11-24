import { Collapsible } from '@base-ui/react/collapsible';
import { useId, type ComponentType, type MouseEvent, type ReactNode } from 'react';

import { Avatar } from '../avatar/Avatar';
import { IconButton } from '../button/Button';
import type { IconProps } from '../icons/Icon';
import {
  AddIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListBulletedIcon,
  CodeFolderIcon,
  ShowMoreHorizontalIcon,
} from '../icons';
import './side-nav.css';

/** Client-side navigation hook: receives the href; when absent, links navigate normally. */
export type Navigate = (href: string) => void;

function linkHandler(href: string, navigate: Navigate | undefined) {
  if (!navigate) return undefined;
  return (event: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab and new-window clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  };
}

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon?: ComponentType<IconProps>;
  /** Avatar or other element shown before the label instead of an icon. */
  before?: ReactNode;
  children?: NavItem[];
};

export type NavSection = {
  id: string;
  /** Optional heading (12/16, bold, faint text). */
  heading?: string;
  items: NavItem[];
};

/** One 32 px link row: optional element before the label, optional element after it. */
function LinkRow({
  href,
  label,
  before,
  after,
  isSelected,
  navigate,
}: {
  href: string;
  label: string;
  before?: ReactNode;
  after?: ReactNode;
  isSelected: boolean;
  navigate?: Navigate;
}) {
  const onClick = linkHandler(href, navigate);
  return (
    <div role="listitem" className={`ui-nav-row${isSelected ? ' ui-nav-row--selected' : ''}`}>
      <a className="ui-nav-row__main" href={href} aria-current={isSelected ? 'page' : undefined} {...(onClick ? { onClick } : {})}>
        <span className="ui-nav-row__bar" aria-hidden="true" />
        <span className="ui-nav-row__label">{label}</span>
      </a>
      {before !== undefined && (
        <span className="ui-nav-row__before" aria-hidden="true">
          {before}
        </span>
      )}
      {after !== undefined && (
        <span className="ui-nav-row__after" aria-hidden="true">
          {after}
        </span>
      )}
    </div>
  );
}

/** A row that shows and hides its children; expanded by default. Hovering swaps the icon for a chevron. */
function ExpandableRow({ label, before, actions, children }: { label: string; before?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <Collapsible.Root defaultOpen className="ui-nav-expandable" render={<div role="listitem" />}>
      <div className="ui-nav-row ui-nav-row--expandable">
        <Collapsible.Trigger className="ui-nav-row__main">
          <span className="ui-nav-row__label">{label}</span>
        </Collapsible.Trigger>
        <span className="ui-nav-row__before" aria-hidden="true">
          {before !== undefined && <span className="ui-nav-row__icon">{before}</span>}
          <span className="ui-nav-row__chevron ui-nav-row__chevron--open">
            <ChevronDownIcon label="" size="small" />
          </span>
          <span className="ui-nav-row__chevron ui-nav-row__chevron--closed">
            <ChevronRightIcon label="" size="small" />
          </span>
        </span>
        {actions !== undefined && <span className="ui-nav-row__actions">{actions}</span>}
      </div>
      <Collapsible.Panel className="ui-nav-expandable__panel" render={<div role="list" />}>
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function Section({ heading, children }: { heading?: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <div role="group" className="ui-nav-section" {...(heading ? { 'aria-labelledby': headingId } : {})}>
      {heading && (
        <p id={headingId} className="ui-nav-section__heading">
          {heading}
        </p>
      )}
      <div role="list">{children}</div>
    </div>
  );
}

/** A plain list of side-nav sections and items (top-level entries such as Início or Filtros). */
export function SideNavMenu({ sections, selectedId, navigate }: { sections: NavSection[]; selectedId?: string; navigate?: Navigate }) {
  return (
    <>
      {sections.map((section) => (
        <Section key={section.id} {...(section.heading ? { heading: section.heading } : {})}>
          {section.items.map((item) => (
            <NavMenuItem key={item.id} item={item} {...(selectedId ? { selectedId } : {})} {...(navigate ? { navigate } : {})} />
          ))}
        </Section>
      ))}
    </>
  );
}

/** One side-nav entry; an item with children becomes an expandable row. */
export function NavMenuItem({ item, selectedId, navigate }: { item: NavItem; selectedId?: string; navigate?: Navigate }) {
  const before = item.before ?? (item.icon ? <item.icon label="" color="currentColor" /> : undefined);
  if (item.children?.length) {
    return (
      <ExpandableRow label={item.label} before={before}>
        {item.children.map((child) => (
          <NavMenuItem key={child.id} item={child} {...(selectedId ? { selectedId } : {})} {...(navigate ? { navigate } : {})} />
        ))}
      </ExpandableRow>
    );
  }
  return <LinkRow href={item.href} label={item.label} before={before} isSelected={item.id === selectedId} navigate={navigate} />;
}

export type ProjectLink = {
  id: string;
  name: string;
  href: string;
};

export type ProjectsMenuItemProps = {
  /** Page with every project ("Mais projetos"). */
  href: string;
  recent: ProjectLink[];
  starred?: ProjectLink[];
  /** Heading of the `starred` list; systems that pin projects by a rule of their own rename it. */
  starredLabel?: string;
  selectedProjectId?: string;
  navigate?: Navigate;
  /** Shows "+" next to the label. Omit while the system cannot create projects. */
  onCreate?: () => void;
  label?: string;
};

function ProjectRows({ projects, selectedProjectId, navigate }: { projects: ProjectLink[]; selectedProjectId?: string; navigate?: Navigate }) {
  return (
    <>
      {projects.map((project) => (
        <LinkRow
          key={project.id}
          href={project.href}
          label={project.name}
          before={<Avatar size="xsmall" appearance="square" name={project.name} />}
          isSelected={project.id === selectedProjectId}
          navigate={navigate}
        />
      ))}
    </>
  );
}

/**
 * "Projetos" in the side nav: an expandable row with "+" and "…", then starred and recent projects,
 * then "Mais projetos".
 */
export function ProjectsMenuItem({
  href,
  recent,
  starred = [],
  starredLabel = 'Marcados com estrela',
  selectedProjectId,
  navigate,
  onCreate,
  label = 'Projetos',
}: ProjectsMenuItemProps) {
  return (
    <ExpandableRow
      label={label}
      before={<CodeFolderIcon label="" color="currentColor" />}
      actions={
        <>
          {onCreate && <IconButton icon={AddIcon} label="Criar projeto" appearance="subtle" spacing="compact" onClick={onCreate} />}
          <IconButton icon={ShowMoreHorizontalIcon} label="Mais ações para projetos" appearance="subtle" spacing="compact" />
        </>
      }
    >
      {starred.length > 0 && (
        <Section heading={starredLabel}>
          <ProjectRows projects={starred} selectedProjectId={selectedProjectId} navigate={navigate} />
        </Section>
      )}
      {recent.length > 0 && (
        <Section heading="Recentes">
          <ProjectRows projects={recent} selectedProjectId={selectedProjectId} navigate={navigate} />
        </Section>
      )}
      <LinkRow
        href={href}
        label="Mais projetos"
        before={<ListBulletedIcon label="" color="currentColor" />}
        after={<ChevronRightIcon label="" color="currentColor" size="small" />}
        isSelected={false}
        navigate={navigate}
      />
    </ExpandableRow>
  );
}
