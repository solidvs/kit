import type { ComponentType, ReactNode } from 'react';

import { AvatarGroup } from '../avatar/AvatarGroup';
import { Breadcrumbs, BreadcrumbsItem } from '../breadcrumbs/Breadcrumbs';
import { Button, IconButton } from '../button/Button';
import {
  AutomationIcon,
  FilterIcon,
  FullscreenEnterIcon,
  LayersIcon,
  SearchIcon,
  ShareIcon,
  ShowMoreHorizontalIcon,
  type IconProps,
} from '../icons';
import { Heading } from '../primitives/Text';
import { Tab, TabList, TabPanel, Tabs } from '../tabs/Tabs';
import { Textfield } from '../textfield/Textfield';
import { token } from '../token';
import './project-page.css';

export type ProjectView = {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  content: ReactNode;
};

export type ProjectPageProps = {
  spaceLabel: string;
  title: string;
  avatar: ReactNode;
  views: ProjectView[];
  selectedViewId: string;
  onViewChange: (viewId: string) => void;
  members: { name: string }[];
};

/**
 * Page of one project: breadcrumbs, title row with the project actions, one tab per view and, in
 * each view, a toolbar (search, members, filter, group) above the view's content.
 */
export function ProjectPage({ spaceLabel, title, avatar, views, selectedViewId, onViewChange, members }: ProjectPageProps) {
  const selectedIndex = Math.max(0, views.findIndex((view) => view.id === selectedViewId));
  return (
    <div className="ui-project-page">
      <div className="ui-project-page__header">
        <Breadcrumbs>
          <BreadcrumbsItem href="#" text={spaceLabel} />
        </Breadcrumbs>
        <div className="ui-project-page__title-row">
          <div className="ui-project-page__title">
            {avatar}
            <Heading size="medium" as="h1">
              {title}
            </Heading>
            <IconButton icon={ShowMoreHorizontalIcon} label="Mais ações do projeto" appearance="subtle" />
          </div>
          <div className="ui-project-page__actions">
            <IconButton icon={ShareIcon} label="Compartilhar" appearance="subtle" />
            <IconButton icon={AutomationIcon} label="Automação" appearance="subtle" />
            <IconButton icon={FullscreenEnterIcon} label="Tela cheia" appearance="subtle" />
          </div>
        </div>
      </div>
      <div className="ui-project-page__body">
        <Tabs
          id="project-views"
          selected={selectedIndex}
          onChange={(index) => onViewChange(views[index]?.id ?? views[0]!.id)}
        >
          <TabList aria-label="Visualizações do projeto">
            {views.map((view) => (
              <Tab key={view.id}>
                <span className="ui-project-page__tab">
                  <view.icon label="" color="currentColor" />
                  {view.label}
                </span>
              </Tab>
            ))}
          </TabList>
          {views.map((view) => (
            <TabPanel key={view.id}>
              <div className="ui-project-page__view">
                <div className="ui-project-page__toolbar">
                  <div className="ui-project-page__toolbar-start">
                    <div className="ui-project-page__search">
                      <Textfield
                        isCompact
                        aria-label="Pesquisar"
                        placeholder="Pesquisar"
                        elemBeforeInput={
                          <span className="ui-project-page__search-icon">
                            <SearchIcon label="" color={token('icon.muted')} />
                          </span>
                        }
                      />
                    </div>
                    <AvatarGroup
                      appearance="stack"
                      size="small"
                      data={members.map((member) => ({ name: member.name, key: member.name }))}
                      label="Membros"
                    />
                    <Button iconBefore={FilterIcon}>Filtrar</Button>
                    <Button iconBefore={LayersIcon}>Agrupar</Button>
                  </div>
                  <IconButton icon={ShowMoreHorizontalIcon} label="Mais ações da visualização" appearance="subtle" />
                </div>
                {view.content}
              </div>
            </TabPanel>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
