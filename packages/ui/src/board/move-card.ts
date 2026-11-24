export type Edge = 'top' | 'bottom';

import type { BoardColumnData } from './types';

export type CardMove = {
  cardId: string;
  toColumnId: string;
  /** Card the dragged card was dropped on, and on which edge; absent when dropped on the column. */
  target?: { cardId: string; edge: Edge };
};

/** Pure function: returns new columns with the card moved; the input is never mutated. */
export function moveCard(columns: BoardColumnData[], move: CardMove): BoardColumnData[] {
  const source = columns.find((column) => column.cards.some((card) => card.id === move.cardId));
  const card = source?.cards.find((c) => c.id === move.cardId);
  if (!source || !card || move.target?.cardId === move.cardId) return columns;

  const withoutCard = columns.map((column) =>
    column.id === source.id ? { ...column, cards: column.cards.filter((c) => c.id !== move.cardId) } : column,
  );

  return withoutCard.map((column) => {
    if (column.id !== move.toColumnId) return column;
    const cards = [...column.cards];
    const targetIndex = move.target ? cards.findIndex((c) => c.id === move.target?.cardId) : -1;
    const insertAt = targetIndex < 0 ? cards.length : move.target?.edge === 'bottom' ? targetIndex + 1 : targetIndex;
    cards.splice(insertAt, 0, card);
    return { ...column, cards };
  });
}
