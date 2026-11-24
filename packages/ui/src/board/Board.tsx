import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';

import { BoardCardPreview } from './BoardCard';
import { BoardColumn } from './BoardColumn';
import { dropPosition, dropTargetAt, nextDropTarget, pointOfDropTarget, sameDropTarget, type DropTarget } from './drop-target';
import { moveCard } from './move-card';
import { columnDropId, isCardDragData, type BoardColumnData } from './types';
import './board.css';

export type BoardProps = {
  columns: BoardColumnData[];
  onColumnsChange: (columns: BoardColumnData[]) => void;
  onAddCard: (columnId: string) => void;
  label: string;
};

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
type Arrow = (typeof ARROWS)[number];
const isArrow = (code: string): code is Arrow => (ARROWS as readonly string[]).includes(code);

const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Para pegar o cartão, pressione Espaço ou Enter. Enquanto ele estiver pego, use as setas para cima e para baixo para mudar a posição e as setas para os lados para mudar de coluna. Pressione Espaço ou Enter para soltar, ou Escape para cancelar.',
};

/**
 * Kanban board. Cards move within and across columns with the pointer or the keyboard; while a card
 * is dragged it stays in place, faded, and a line shows where it will land. The order lives with the
 * caller: every drop calls `onColumnsChange` with the result of `moveCard`.
 */
export function Board({ columns, onColumnsChange, onAddCard, label }: BoardProps) {
  const [dragged, setDragged] = useState<{ cardId: string; byKeyboard: boolean } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // Read by dnd-kit callbacks, which may run before the next render.
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const draggedRef = useRef<string | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  // Last announced target; undefined until the first one, which is the card's own place.
  const announcedRef = useRef<DropTarget | null | undefined>(undefined);

  // After a keyboard drop the card is rendered again in its new place; keep the focus on it.
  useEffect(() => {
    if (!focusCardId) return;
    boardRef.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(focusCardId)}"]`)?.focus();
    setFocusCardId(null);
  }, [focusCardId, columns]);

  const collisionDetection: CollisionDetection = ({ collisionRect, droppableRects, pointerCoordinates }) => {
    const cardId = draggedRef.current;
    if (!cardId) return [];
    const point = pointerCoordinates ?? {
      x: collisionRect.left + collisionRect.width / 2,
      y: collisionRect.top + collisionRect.height / 2,
    };
    const target = dropTargetAt(point, droppableRects, columnsRef.current, cardId);
    return target ? [{ id: columnDropId(target.columnId), data: { dropTarget: target } }] : [];
  };

  const coordinateGetter: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects } }) => {
    if (!isArrow(event.code)) return undefined;
    event.preventDefault();
    const cardId = draggedRef.current;
    const current = targetRef.current;
    if (!cardId || !current || !collisionRect) return undefined;
    const next = nextDropTarget(current, event.code, columnsRef.current, cardId);
    const point = next && pointOfDropTarget(next, droppableRects);
    if (!point) return undefined;
    return { x: point.x - collisionRect.width / 2, y: point.y - collisionRect.height / 2 };
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const track = (event: DragMoveEvent) => {
    const target = (event.over && (event.collisions?.[0]?.data?.dropTarget as DropTarget | undefined)) || null;
    targetRef.current = target;
    setDropTarget((previous) => (sameDropTarget(previous, target) ? previous : target));
  };

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const data = active.data.current;
    if (!isCardDragData(data)) return;
    draggedRef.current = data.cardId;
    targetRef.current = null;
    announcedRef.current = undefined;
    setDragged({ cardId: data.cardId, byKeyboard: activatorEvent instanceof KeyboardEvent });
  };

  const handleDragEnd = ({ over, activatorEvent }: DragEndEvent) => {
    const cardId = draggedRef.current;
    const target = over ? targetRef.current : null;
    setDragged(null);
    setDropTarget(null);
    if (!cardId || !target) return;
    onColumnsChange(moveCard(columns, { cardId, toColumnId: target.columnId, target: target.target }));
    if (activatorEvent instanceof KeyboardEvent) setFocusCardId(cardId);
  };

  const handleDragCancel = () => {
    setDragged(null);
    setDropTarget(null);
  };

  const announcements = boardAnnouncements(columnsRef, targetRef, announcedRef);
  const draggedCard = dragged && columns.flatMap((column) => column.cards).find((card) => card.id === dragged.cardId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
      onDragStart={handleDragStart}
      onDragOver={track}
      onDragMove={track}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div ref={boardRef} className="ui-board" role="region" aria-label={label}>
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            onAddCard={onAddCard}
            dropTarget={dropTarget?.columnId === column.id ? dropTarget : null}
          />
        ))}
      </div>
      {/* The copy under the pointer; with the keyboard, the drop line alone shows the position. */}
      <DragOverlay dropAnimation={null}>
        {draggedCard && !dragged.byKeyboard ? <BoardCardPreview card={draggedCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

type Ref<T> = { current: T };

/** Screen reader announcements in Portuguese; a move is announced only when the drop target changes. */
function boardAnnouncements(
  columnsRef: Ref<BoardColumnData[]>,
  targetRef: Ref<DropTarget | null>,
  announcedRef: Ref<DropTarget | null | undefined>,
): Announcements {
  const cardOf = (active: Active) => {
    const data = active.data.current;
    if (!isCardDragData(data)) return null;
    const column = columnsRef.current.find((c) => c.id === data.columnId);
    const index = column?.cards.findIndex((card) => card.id === data.cardId) ?? -1;
    const card = column?.cards[index];
    return card && column ? { card, column, index } : null;
  };
  const where = (target: DropTarget, cardId: string) => {
    const { column, position, total } = dropPosition(target, columnsRef.current, cardId);
    return `coluna ${column?.title ?? ''}, posição ${position} de ${total}`;
  };
  const onMove = ({ active }: { active: Active }) => {
    const dragged = cardOf(active);
    const target = targetRef.current;
    if (!dragged) return undefined;
    const first = announcedRef.current === undefined;
    if (!first && sameDropTarget(target, announcedRef.current ?? null)) return undefined;
    announcedRef.current = target;
    if (first) return undefined;
    return target
      ? `Cartão ${dragged.card.summary} sobre ${where(target, dragged.card.id)}.`
      : `Cartão ${dragged.card.summary} fora das colunas.`;
  };
  return {
    onDragStart: ({ active }) => {
      const dragged = cardOf(active);
      if (!dragged) return undefined;
      const { card, column, index } = dragged;
      return `Cartão ${card.summary} pego na coluna ${column.title}, posição ${index + 1} de ${column.cards.length}.`;
    },
    onDragMove: onMove,
    onDragOver: onMove,
    onDragEnd: ({ active, over }) => {
      const dragged = cardOf(active);
      if (!dragged) return undefined;
      const target = over ? targetRef.current : null;
      return target
        ? `Cartão ${dragged.card.summary} solto na ${where(target, dragged.card.id)}.`
        : `Cartão ${dragged.card.summary} solto fora das colunas; ele continua onde estava.`;
    },
    onDragCancel: ({ active }) => {
      const dragged = cardOf(active);
      return dragged ? `Movimento cancelado. O cartão ${dragged.card.summary} continua onde estava.` : undefined;
    },
  };
}
