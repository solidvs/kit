import { useSortable } from '@dnd-kit/sortable';
import type { ComponentType } from 'react';

import { Avatar } from '../avatar/Avatar';
import {
  BugIcon,
  PriorityHighIcon,
  PriorityLowIcon,
  PriorityMediumIcon,
  StoryIcon,
  TaskIcon,
  type IconProps,
} from '../icons';
import { Text } from '../primitives/Text';
import { token } from '../token';
import type { Edge } from './move-card';
import { cardDropId, type BoardCardData, type CardDragData, type Priority, type WorkType } from './types';
import './board-card.css';

type Marker = { icon: ComponentType<IconProps>; label: string; color: string };

const WORK_TYPE: Record<WorkType, Marker> = {
  task: { icon: TaskIcon, label: 'Tarefa', color: token('icon.info') },
  bug: { icon: BugIcon, label: 'Defeito', color: token('icon.danger') },
  story: { icon: StoryIcon, label: 'História', color: token('icon.success') },
};

const PRIORITY: Record<Priority, Marker> = {
  high: { icon: PriorityHighIcon, label: 'Prioridade alta', color: token('icon.danger') },
  medium: { icon: PriorityMediumIcon, label: 'Prioridade média', color: token('icon.warning') },
  low: { icon: PriorityLowIcon, label: 'Prioridade baixa', color: token('icon.info') },
};

/** Content of a card: summary, work type and key, priority and assignee. */
function CardContent({ card }: { card: BoardCardData }) {
  const type = WORK_TYPE[card.type];
  const priority = PRIORITY[card.priority];
  return (
    <div className="ui-board-card__content">
      <Text maxLines={3}>{card.summary}</Text>
      <div className="ui-board-card__footer">
        <div className="ui-board-card__key">
          <type.icon label={type.label} color={type.color} />
          <Text size="small" weight="medium" color="text.muted">
            {card.key}
          </Text>
        </div>
        <div className="ui-board-card__meta">
          <priority.icon label={priority.label} color={priority.color} />
          <Avatar size="small" name={card.assignee?.name ?? 'Não atribuído'} />
        </div>
      </div>
    </div>
  );
}

export type BoardCardProps = {
  card: BoardCardData;
  columnId: string;
  /** Edge of this card where the dragged card would land, if any. */
  dropEdge?: Edge | null;
};

/**
 * Card of the board. Drag it with the pointer, or focus it and press Space or Enter, move it with
 * the arrow keys and press Space or Enter again to drop it (Escape cancels).
 */
export function BoardCard({ card, columnId, dropEdge = null }: BoardCardProps) {
  const data: CardDragData = { kind: 'card', cardId: card.id, columnId };
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({
    id: cardDropId(card.id),
    data,
    attributes: { role: 'listitem', roleDescription: 'cartão arrastável' },
  });
  // The card stays in place while dragged (the drop indicator shows where it will land), so the
  // sortable transform is not applied; `aria-pressed` does not belong on a list item.
  const { 'aria-pressed': _pressed, 'aria-disabled': _disabled, ...a11y } = attributes;
  return (
    <div
      ref={setNodeRef}
      className={`ui-board-card${isDragging ? ' ui-board-card--dragging' : ''}`}
      aria-label={card.summary}
      data-card-id={card.id}
      {...a11y}
      {...listeners}
    >
      <CardContent card={card} />
      {dropEdge && <span className={`ui-board-card__drop-indicator ui-board-card__drop-indicator--${dropEdge}`} aria-hidden />}
    </div>
  );
}

/** Copy of a card that follows the pointer while it is dragged. */
export function BoardCardPreview({ card }: { card: BoardCardData }) {
  return (
    <div className="ui-board-card ui-board-card--preview" aria-hidden>
      <CardContent card={card} />
    </div>
  );
}
