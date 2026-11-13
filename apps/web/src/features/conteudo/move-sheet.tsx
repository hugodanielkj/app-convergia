import { Check } from "lucide-react";
import type { ContentDto } from "../../api/client";
import { BottomSheet } from "../../components/bottom-sheet";
import { STATUS_LABEL, STATUS_ORDER } from "./labels";

/** "Mover para...": no celular substitui o arrastar do kanban (design §13.2). */
export function MoveSheet({
	content,
	onClose,
	onMove,
	error,
	busy,
}: {
	content: ContentDto | null;
	onClose: () => void;
	onMove: (status: ContentDto["status"]) => void;
	error?: string | null;
	busy?: boolean;
}) {
	return (
		<BottomSheet
			open={content !== null}
			title="Mover para..."
			onClose={onClose}
		>
			{error && (
				<p
					role="alert"
					className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
				>
					{error}
				</p>
			)}
			<ul className="flex flex-col">
				{STATUS_ORDER.map((status) => {
					const current = content?.status === status;
					return (
						<li key={status}>
							<button
								type="button"
								disabled={current || busy}
								onClick={() => onMove(status)}
								aria-current={current ? "true" : undefined}
								className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-800"
							>
								<span className="font-medium">{STATUS_LABEL[status]}</span>
								{current && (
									<Check
										className="size-5 text-brand-600"
										aria-label="Coluna atual"
									/>
								)}
							</button>
						</li>
					);
				})}
			</ul>
		</BottomSheet>
	);
}
