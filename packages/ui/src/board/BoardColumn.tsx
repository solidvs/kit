import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { IconButton } from '../button/Button';
import { AddIcon, ShowMoreHorizontalIcon } from '../icons';
import { Text } from '../primitives/Text';
import { BoardCard } from './BoardCard';
import type { DropTarget } from './drop-target';
import { cardDropId, columnDropId, type BoardColumnData, type ColumnDropData } from './types';
import './board-column.css';

export type BoardColumnProps = {
  column: BoardColumnData;
  onAddCard: (columnId: string) => void;
  /** Where the dragged card would land, when it is over this column. */
  dropTarget?: DropTarget | null;
};

/** Column of the board: title and count, its cards, and a button that creates a card in it. */
export function BoardColumn({ column, onAddCard, dropTarget = null }: BoardColumnProps) {
  const data: ColumnDropData = { kind: 'column', columnId: column.id };
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.id), data });
  const headingId = `column-${column.id}-heading`;

  return (
    <div
      ref={setNodeRef}
      className={`ui-board-column${isOver ? ' ui-board-column--over' : ''}`}
      role="group"
      aria-labelledby={headingId}
    >
      <div className="ui-board-column__header">
        <div className="ui-board-column__title">
          <Text id={headingId} size="small" weight="medium" color="text.muted">
            {column.title}
          </Text>
          <Text size="small" color="text.faint">
            {column.cards.length}
          </Text>
        </div>
        <IconButton icon={ShowMoreHorizontalIcon} label={`Ações da coluna ${column.title}`} appearance="subtle" spacing="compact" />
      </div>
      <SortableContext items={column.cards.map((card) => cardDropId(card.id))} strategy={verticalListSortingStrategy}>
        <div className="ui-board-column__cards" role="list">
          {column.cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              columnId={column.id}
              dropEdge={dropTarget?.target?.cardId === card.id ? dropTarget.target.edge : null}
            />
          ))}
        </div>
      </SortableContext>
      <button type="button" className="ui-board-column__add" onClick={() => onAddCard(column.id)} aria-label={`Criar em ${column.title}`}>
        <AddIcon label="" size="small" color="currentColor" />
      </button>
    </div>
  );
}
