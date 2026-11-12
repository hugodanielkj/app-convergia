import type { KanbanStatus } from "../content";

type Positioned = { status: KanbanStatus; position: number };

/** Posição depois do último card da coluna. */
export function endOfColumn(cards: Positioned[], status: KanbanStatus): number {
	const positions = cards
		.filter((card) => card.status === status)
		.map((card) => card.position);
	return positions.length === 0 ? 1 : Math.max(...positions) + 1;
}

/**
 * Posição para ficar no índice `index` de uma coluna já ordenada (sem o card que se move).
 * Usa o ponto médio entre os vizinhos, assim nenhum outro card precisa mudar.
 */
export function positionAt(column: number[], index: number): number {
	const before = column[index - 1];
	const after = column[index];
	if (before === undefined && after === undefined) return 1;
	if (before === undefined) return (after as number) - 1;
	if (after === undefined) return before + 1;
	return (before + after) / 2;
}
