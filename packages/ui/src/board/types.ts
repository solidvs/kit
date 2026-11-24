export type WorkType = 'task' | 'bug' | 'story';
export type Priority = 'high' | 'medium' | 'low';

export type BoardCardData = {
  id: string;
  /** Human key shown on the card, e.g. "TI-12". */
  key: string;
  summary: string;
  type: WorkType;
  priority: Priority;
  assignee?: { name: string };
};

export type BoardColumnData = {
  id: string;
  title: string;
  cards: BoardCardData[];
};

/** Data attached to the draggable cards and to the column drop targets (dnd-kit `data`). */
export type CardDragData = { kind: 'card'; cardId: string; columnId: string };
export type ColumnDropData = { kind: 'column'; columnId: string };

export function isCardDragData(data: Record<string | symbol, unknown> | null | undefined): data is CardDragData {
  return data?.kind === 'card';
}

export function isColumnDropData(data: Record<string | symbol, unknown> | null | undefined): data is ColumnDropData {
  return data?.kind === 'column';
}

/** dnd-kit ids: cards and columns share one id space, so each kind gets a prefix. */
export const cardDropId = (cardId: string) => `card:${cardId}`;
export const columnDropId = (columnId: string) => `column:${columnId}`;
