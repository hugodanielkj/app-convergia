import { useQuery } from "@tanstack/react-query";
import { SquarePlus } from "lucide-react";
import { useState } from "react";
import { type ContentDto, errorMessage } from "../../api/client";
import { contentsQuery } from "../../api/queries";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
import { cn } from "../../lib/cn";
import { ContentCard } from "./content-card";
import { STATUS_LABEL, STATUS_ORDER } from "./labels";
import { MoveSheet } from "./move-sheet";
import { useContentMutations } from "./mutations";

type Status = ContentDto["status"];

/**
 * Kanban (RN-061). No celular, uma aba por coluna; do tablet em diante, as quatro colunas.
 * Mover é pelo botão "Mover para...", em vez de arrastar (design §13.2).
 */
export function KanbanView({ companyId }: { companyId: string }) {
	const query = useQuery(contentsQuery(companyId));
	const [column, setColumn] = useState<Status>("idea");
	const [moving, setMoving] = useState<ContentDto | null>(null);
	const { move } = useContentMutations(companyId);

	if (query.isPending) return <SkeletonList rows={4} />;
	if (query.isError) return <ErrorState message={errorMessage(query.error)} />;

	const byStatus = (status: Status) =>
		query.data.contents.filter((content) => content.status === status);

	const columnList = (status: Status) => {
		const cards = byStatus(status);
		return cards.length === 0 ? (
			<EmptyState icon={SquarePlus} title={`Nada em ${STATUS_LABEL[status]}`}>
				Toque em Criar para começar um card.
			</EmptyState>
		) : (
			<ul className="flex flex-col gap-2">
				{cards.map((content) => (
					<li key={content.id}>
						<ContentCard
							content={content}
							onMove={() => {
								move.reset();
								setMoving(content);
							}}
						/>
					</li>
				))}
			</ul>
		);
	};

	return (
		<>
			<div
				role="tablist"
				aria-label="Colunas do kanban"
				className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden"
			>
				{STATUS_ORDER.map((status) => (
					<button
						key={status}
						type="button"
						role="tab"
						aria-selected={column === status}
						onClick={() => setColumn(status)}
						className={cn(
							"flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium",
							column === status
								? "bg-brand-600 text-white"
								: "bg-white text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800",
						)}
					>
						{STATUS_LABEL[status]}
						<span className="text-xs opacity-80">
							{byStatus(status).length}
						</span>
					</button>
				))}
			</div>
			<div role="tabpanel" className="mt-3 md:hidden">
				{columnList(column)}
			</div>

			<div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">
				{STATUS_ORDER.map((status) => (
					<section
						key={status}
						aria-label={STATUS_LABEL[status]}
						className="flex flex-col gap-2 rounded-2xl bg-zinc-100 p-2 dark:bg-zinc-900/60"
					>
						<h3 className="px-2 pt-1 text-sm font-semibold">
							{STATUS_LABEL[status]}{" "}
							<span className="text-zinc-500">{byStatus(status).length}</span>
						</h3>
						{columnList(status)}
					</section>
				))}
			</div>

			<MoveSheet
				content={moving}
				busy={move.isPending}
				error={move.error ? errorMessage(move.error) : null}
				onClose={() => setMoving(null)}
				onMove={(status) => {
					if (!moving) return;
					move.mutate(
						{ id: moving.id, status },
						{ onSuccess: () => setMoving(null) },
					);
				}}
			/>
		</>
	);
}
