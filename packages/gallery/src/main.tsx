import * as UI from '@solidvs/ui';
import {
  AppShell,
  Avatar,
  Board,
  Box,
  Button,
  Heading,
  IconButton,
  Inline,
  Lozenge,
  PlatformProvider,
  ProjectPage,
  ProjectsMenuItem,
  SideNavMenu,
  Stack,
  Text,
  token,
  type BoardColumnData,
  type ColorMode,
  type IconProps,
} from '@solidvs/ui';
import { useState, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/*
 * The gallery renders every export of the UI package with fixed data, one section per URL
 * (`?section=<id>&mode=light|dark`). `scripts/capture.ts` screenshots each section; the screenshots
 * of version 0.1.x are the baseline the rewritten package must match (ADR-0011).
 */

const params = new URLSearchParams(window.location.search);
const section = params.get('section') ?? 'index';
const mode = (params.get('mode') ?? 'light') as ColorMode;

const noop = () => undefined;

const COLUMNS: BoardColumnData[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'c1', key: 'TI-12', summary: 'Levantar os servidores de integração', type: 'task', priority: 'high', assignee: { name: 'Ana Souza' } },
      { id: 'c2', key: 'TI-14', summary: 'Corrigir o filtro de projetos quando a lista está vazia e o usuário volta da página anterior', type: 'bug', priority: 'medium' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'c3', key: 'TI-9', summary: 'Tela de deploys', type: 'story', priority: 'low', assignee: { name: 'Bruno Lima' } }],
  },
  { id: 'done', title: 'Concluído', cards: [] },
];

function BoardDemo() {
  const [columns, setColumns] = useState(COLUMNS);
  return <Board columns={columns} onColumnsChange={setColumns} onAddCard={noop} label="Quadro do projeto" />;
}

function ProjectDemo() {
  const [view, setView] = useState('board');
  return (
    <ProjectPage
      spaceLabel="Projetos"
      title="Portal de TI"
      avatar={<Avatar size="medium" appearance="square" name="Portal de TI" />}
      views={[
        { id: 'summary', label: 'Resumo', icon: UI.GlobeIcon, content: <Text>Resumo do projeto.</Text> },
        { id: 'board', label: 'Quadro', icon: UI.BoardIcon, content: <BoardDemo /> },
        { id: 'list', label: 'Lista', icon: UI.ListBulletedIcon, content: <Text>Lista.</Text> },
        { id: 'timeline', label: 'Cronograma', icon: UI.TimelineIcon, content: <Text>Cronograma.</Text> },
      ]}
      selectedViewId={view}
      onViewChange={setView}
      members={[{ name: 'Ana Souza' }, { name: 'Bruno Lima' }, { name: 'Carla Dias' }]}
    />
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      userName="Ana Souza"
      notificationCount={3}
      onCreate={noop}
      showSettings
      sideNav={
        <>
          <SideNavMenu
            selectedId="home"
            sections={[
              {
                id: 'main',
                items: [
                  { id: 'home', label: 'Início', href: '#home', icon: UI.HomeIcon },
                  { id: 'inbox', label: 'Solicitações', href: '#inbox', icon: UI.InboxIcon },
                ],
              },
            ]}
          />
          <ProjectsMenuItem
            href="#projects"
            onCreate={noop}
            selectedProjectId="p2"
            starred={[{ id: 'p1', name: 'Plataforma', href: '#p1' }]}
            recent={[
              { id: 'p2', name: 'Portal de TI', href: '#p2' },
              { id: 'p3', name: 'Integrações', href: '#p3' },
            ]}
          />
          <SideNavMenu
            sections={[
              {
                id: 'more',
                heading: 'Operação',
                items: [
                  { id: 'deploys', label: 'Deploys', href: '#deploys', icon: UI.DeploymentIcon },
                  {
                    id: 'stack',
                    label: 'Stack',
                    href: '#stack',
                    icon: UI.LayersIcon,
                    children: [
                      { id: 'db', label: 'Bancos de dados', href: '#db', icon: UI.DatabaseIcon },
                      { id: 'dash', label: 'Painéis', href: '#dash', icon: UI.DashboardIcon },
                    ],
                  },
                ],
              },
            ]}
          />
        </>
      }
    >
      {children}
    </AppShell>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <Box padding="space.24" style={{ backgroundColor: token('surface') }}>
      <Stack space="space.24">{children}</Stack>
    </Box>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack space="space.8">
      <Text size="small" color="text.faint">
        {label}
      </Text>
      <Inline space="space.16" alignBlock="center" shouldWrap>
        {children}
      </Inline>
    </Stack>
  );
}

// Deprecated aliases (same glyph as their new name) are left out so each glyph shows once.
const DEPRECATED_ICONS = new Set(['ProjectIcon', 'RepositoryIcon']);
const ICONS = Object.entries(UI)
  .filter(([name]) => name.endsWith('Icon') && name !== 'PlatformIcon' && !DEPRECATED_ICONS.has(name))
  .sort(([a], [b]) => a.localeCompare(b)) as [string, ComponentType<IconProps>][];

const SECTIONS: Record<string, () => ReactNode> = {
  shell: () => (
    <Shell>
      <ProjectDemo />
    </Shell>
  ),
  'shell-home': () => (
    <Shell>
      <Box padding="space.24">
        <Stack space="space.16">
          <Heading size="large" as="h1">
            Início
          </Heading>
          <Text color="text.muted">Bem-vinda, Ana. Estes são os projetos que você acompanha.</Text>
          <Inline space="space.8" alignBlock="center">
            <Lozenge appearance="inprogress">Em andamento</Lozenge>
            <Lozenge appearance="success">Concluído</Lozenge>
          </Inline>
        </Stack>
      </Box>
    </Shell>
  ),
  buttons: () => (
    <Grid>
      <Row label="Button">
        <Button>Padrão</Button>
        <Button appearance="primary">Primário</Button>
        <Button appearance="subtle">Sutil</Button>
        <Button appearance="warning">Aviso</Button>
        <Button appearance="danger">Perigo</Button>
        <Button appearance="discovery">Novidade</Button>
        <Button isDisabled>Desabilitado</Button>
        <Button isSelected>Selecionado</Button>
      </Row>
      <Row label="Button with icon">
        <Button iconBefore={UI.FilterIcon}>Filtrar</Button>
        <Button iconBefore={UI.LayersIcon}>Agrupar</Button>
        <Button appearance="primary" iconBefore={UI.AddIcon}>
          Criar
        </Button>
        <Button iconAfter={UI.ChevronDownIcon}>Mais</Button>
        <Button spacing="compact">Compacto</Button>
        <Button appearance="primary" spacing="compact">
          Compacto
        </Button>
      </Row>
      <Row label="IconButton">
        <IconButton icon={UI.ShowMoreHorizontalIcon} label="Mais" />
        <IconButton icon={UI.ShowMoreHorizontalIcon} label="Mais" appearance="subtle" />
        <IconButton icon={UI.AddIcon} label="Criar" appearance="primary" />
        <IconButton icon={UI.AddIcon} label="Criar" appearance="subtle" spacing="compact" />
        <IconButton icon={UI.ShareIcon} label="Compartilhar" isDisabled />
        <IconButton icon={UI.StarUnstarredIcon} label="Marcar" appearance="subtle" isSelected />
        <IconButton icon={UI.PersonIcon} label="Pessoa" shape="circle" />
      </Row>
    </Grid>
  ),
  typography: () => (
    <Grid>
      <Stack space="space.12">
        {(['xxlarge', 'xlarge', 'large', 'medium', 'small', 'xsmall', 'xxsmall'] as const).map((size) => (
          <Heading key={size} size={size}>
            Título {size} — Portal de TI
          </Heading>
        ))}
      </Stack>
      <Stack space="space.8">
        {(['large', 'medium', 'small'] as const).map((size) => (
          <Text key={size} size={size}>
            Texto {size}: a plataforma registra cada projeto e cada deploy com rastreabilidade.
          </Text>
        ))}
        <Text weight="medium">Peso médio</Text>
        <Text weight="semibold">Peso seminegrito</Text>
        <Text weight="bold">Peso negrito</Text>
        <Text color="text.muted">Cor sutil</Text>
        <Text color="text.faint">Cor mais sutil</Text>
        <Text color="text.disabled">Cor desabilitada</Text>
        <Text color="text.danger">Cor perigo</Text>
        <Text color="text.success">Cor sucesso</Text>
        <Text color="link">Cor link</Text>
        <Box style={{ width: '240px' }}>
          <Text maxLines={2}>Texto longo que precisa ser cortado em duas linhas para caber no cartão sem quebrar o layout da coluna.</Text>
        </Box>
        <Text as="p">
          Parágrafo com <Text as="strong">destaque</Text> e <Text as="em">ênfase</Text>.
        </Text>
      </Stack>
    </Grid>
  ),
  lozenges: () => (
    <Grid>
      {[false, true].map((isBold) => (
        <Row key={String(isBold)} label={isBold ? 'Lozenge bold' : 'Lozenge'}>
          {(['default', 'inprogress', 'moved', 'new', 'removed', 'success'] as const).map((appearance) => (
            <Lozenge key={appearance} appearance={appearance} isBold={isBold}>
              {appearance}
            </Lozenge>
          ))}
          <Lozenge maxWidth={80}>Texto longo demais para caber</Lozenge>
        </Row>
      ))}
    </Grid>
  ),
  avatars: () => (
    <Grid>
      {(['circle', 'square'] as const).map((appearance) => (
        <Row key={appearance} label={`Avatar ${appearance}`}>
          {(['xsmall', 'small', 'medium', 'large', 'xlarge', 'xxlarge'] as const).map((size) => (
            <Avatar key={size} size={size} appearance={appearance} name="Ana Souza" />
          ))}
        </Row>
      ))}
    </Grid>
  ),
  layout: () => (
    <Grid>
      <Row label="Inline space">
        {(['space.4', 'space.8', 'space.16', 'space.24'] as const).map((space) => (
          <Inline key={space} space={space}>
            <Swatch />
            <Swatch />
            <Swatch />
          </Inline>
        ))}
      </Row>
      <Inline spread="space-between" alignBlock="center">
        <Swatch />
        <Swatch tall />
        <Swatch />
      </Inline>
      <Stack space="space.6">
        <Swatch wide />
        <Swatch wide />
      </Stack>
      <Box padding="space.16" paddingBlock="space.8" paddingInline="space.32" style={{ outline: `1px dashed ${token('border')}` }}>
        <Swatch />
      </Box>
    </Grid>
  ),
  html: () => (
    <div style={{ padding: 24 }}>
      <h1>Título h1</h1>
      <h2>Título h2</h2>
      <h3>Título h3</h3>
      <h4>Título h4</h4>
      <h5>Título h5</h5>
      <h6>Título h6</h6>
      <p>
        Parágrafo com <a href="#link">um link</a>, <strong>negrito</strong>, <em>itálico</em>, <small>pequeno</small> e{' '}
        <code>código</code>.
      </p>
      <p>Segundo parágrafo, para medir o espaço entre parágrafos.</p>
      <ul>
        <li>Item de lista</li>
        <li>Outro item</li>
      </ul>
      <ol>
        <li>Primeiro</li>
        <li>Segundo</li>
      </ol>
      <blockquote>Citação curta.</blockquote>
      <pre>bloco de código</pre>
      <hr />
      <table>
        <thead>
          <tr>
            <th>Coluna</th>
            <th>Outra</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valor</td>
            <td>Valor 2</td>
          </tr>
        </tbody>
      </table>
      <p>
        <input aria-label="Campo" defaultValue="texto" /> <button type="button">Botão nativo</button> <select aria-label="Opção"><option>Opção</option></select>
      </p>
      <dl>
        <dt>Termo</dt>
        <dd>Definição</dd>
      </dl>
    </div>
  ),
  icons: () => (
    <Grid>
      <Inline space="space.16" shouldWrap>
        {ICONS.map(([name, Icon]) => (
          <Stack key={name} space="space.4" alignInline="center">
            <Inline space="space.8" alignBlock="center">
              <Icon label="" color="currentColor" />
              <Icon label="" color={token('icon.muted')} size="small" />
              <Icon label="" color={token('icon.brand')} />
            </Inline>
            <Text size="small" color="text.faint">
              {name.replace(/Icon$/, '')}
            </Text>
          </Stack>
        ))}
      </Inline>
    </Grid>
  ),
};

function Swatch({ tall, wide }: { tall?: boolean; wide?: boolean }) {
  return (
    <span
      style={{
        display: 'block',
        width: wide ? 240 : 32,
        height: tall ? 48 : 24,
        borderRadius: token('radius.4'),
        backgroundColor: token('bg.accent.blue.light'),
      }}
    />
  );
}

function Index() {
  return (
    <Grid>
      {Object.keys(SECTIONS).map((id) => (
        <a key={id} href={`?section=${id}&mode=${mode}`}>
          {id}
        </a>
      ))}
    </Grid>
  );
}

const render = SECTIONS[section] ?? Index;
const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(<PlatformProvider defaultColorMode={mode}>{render()}</PlatformProvider>);
// Exposed for the capture script: the list of sections, so it never drifts from this file.
(window as unknown as { __sections: string[] }).__sections = Object.keys(SECTIONS);
