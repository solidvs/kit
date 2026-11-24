import type { ClientRect, UniqueIdentifier } from '@dnd-kit/core';

import type { CardMove } from './move-card';
import { cardDropId, columnDropId, type BoardColumnData } from './types';

/** Where a dragged card would land: a column and, unless it is empty, the edge of one of its cards. */
export type DropTarget = { columnId: string; target?: NonNullable<CardMove['target']> };

type Point = { x: number; y: number };
type Rects = Map<UniqueIdentifier, ClientRect>;

export function sameDropTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  return (
    a?.columnId === b?.columnId && a?.target?.cardId === b?.target?.cardId && a?.target?.edge === b?.target?.edge
  );
}

const inside = (point: Point, rect: ClientRect) =>
  point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

/**
 * Drop target under a point: the column that contains it and the nearest other card of that column,
 * on the edge closest to the point. Over the dragged card itself, the nearest neighbour gives the
 * card's current position, so dropping there changes nothing.
 */
export function dropTargetAt(point: Point, rects: Rects, columns: BoardColumnData[], activeCardId: string): DropTarget | null {
  for (const column of columns) {
    const columnRect = rects.get(columnDropId(column.id));
    if (!columnRect || !inside(point, columnRect)) continue;
    let nearest: { cardId: string; rect: ClientRect; distance: number } | null = null;
    for (const card of column.cards) {
      const rect = card.id === activeCardId ? undefined : rects.get(cardDropId(card.id));
      if (!rect) continue;
      const distance = point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0;
      if (!nearest || distance < nearest.distance) nearest = { cardId: card.id, rect, distance };
    }
    if (!nearest) return { columnId: column.id };
    const edge = point.y < nearest.rect.top + nearest.rect.height / 2 ? 'top' : 'bottom';
    return { columnId: column.id, target: { cardId: nearest.cardId, edge } };
  }
  return null;
}

/** Point inside a drop target, used to move the keyboard-dragged card there. */
export function pointOfDropTarget(dropTarget: DropTarget, rects: Rects): Point | null {
  if (!dropTarget.target) {
    const rect = rects.get(columnDropId(dropTarget.columnId));
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  }
  const rect = rects.get(cardDropId(dropTarget.target.cardId));
  if (!rect) return null;
  const fraction = dropTarget.target.edge === 'top' ? 0.25 : 0.75;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * fraction };
}

/**
 * Keyboard movement. A column with n other cards has n + 1 slots; up and down move one slot,
 * left and right move to the same slot (or the last one) of the neighbouring column.
 */
export function nextDropTarget(
  current: DropTarget,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  columns: BoardColumnData[],
  activeCardId: string,
): DropTarget | null {
  const columnIndex = columns.findIndex((column) => column.id === current.columnId);
  const column = columns[columnIndex];
  if (!column) return null;
  const others = column.cards.filter((card) => card.id !== activeCardId);
  const targetIndex = current.target ? others.findIndex((card) => card.id === current.target?.cardId) : -1;
  let slot = targetIndex < 0 ? 0 : current.target?.edge === 'bottom' ? targetIndex + 1 : targetIndex;
  let nextColumnIndex = columnIndex;
  if (key === 'ArrowUp') slot -= 1;
  if (key === 'ArrowDown') slot += 1;
  if (key === 'ArrowLeft') nextColumnIndex -= 1;
  if (key === 'ArrowRight') nextColumnIndex += 1;
  const nextColumn = columns[nextColumnIndex];
  if (!nextColumn) return null;
  const nextOthers = nextColumn.cards.filter((card) => card.id !== activeCardId);
  if (nextColumnIndex === columnIndex && (slot < 0 || slot > nextOthers.length)) return null;
  slot = Math.min(Math.max(slot, 0), nextOthers.length);
  const before = nextOthers[slot];
  const after = nextOthers[slot - 1];
  if (before) return { columnId: nextColumn.id, target: { cardId: before.id, edge: 'top' } };
  if (after) return { columnId: nextColumn.id, target: { cardId: after.id, edge: 'bottom' } };
  return { columnId: nextColumn.id };
}

/** 1-based position the dragged card would take in the target column, and that column's final size. */
export function dropPosition(dropTarget: DropTarget, columns: BoardColumnData[], activeCardId: string) {
  const column = columns.find((c) => c.id === dropTarget.columnId);
  const others = column?.cards.filter((card) => card.id !== activeCardId) ?? [];
  const index = dropTarget.target ? others.findIndex((card) => card.id === dropTarget.target?.cardId) : others.length;
  const position = dropTarget.target?.edge === 'bottom' ? index + 2 : index + 1;
  return { column, position, total: others.length + 1 };
}
