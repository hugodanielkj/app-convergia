import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { errorMessage, type HistoryEntryDto } from "../../api/client";
import { historyQuery } from "../../api/queries";
import { BottomSheet } from "../../components/bottom-sheet";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
import { SCRIPT_FIELD_LABEL } from "./script-options-sheet";
import { ScriptPreview } from "./script-preview";

const when = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});

/**
 * 📎 RN-072: histórico de gerações do card, das mais novas para as mais antigas. Só leitura:
 * roteiros completos (RN-070) e opções avulsas (RN-071), com quem gerou e quando.
 */
export function HistorySheet({
	companyId,
	contentId,
	open,
	onClose,
}: {
	companyId: string;
	contentId: string;
	open: boolean;
	onClose: () => void;
}) {
	const history = useQuery({
		...historyQuery(companyId, contentId),
		enabled: open,
	});

	return (
		<BottomSheet open={open} title="Histórico de gerações" onClose={onClose}>
			<div className="flex max-h-[65dvh] flex-col gap-3 overflow-y-auto">
				{history.isPending ? (
					<SkeletonList rows={3} />
				) : history.isError ? (
					<ErrorState message={errorMessage(history.error)} />
				) : history.data.entries.length === 0 ? (
					<EmptyState icon={History} title="Nenhuma geração ainda">
						Os roteiros e as opções que a IA escrever para este card aparecem
						aqui.
					</EmptyState>
				) : (
					<ol className="flex flex-col gap-3">
						{history.data.entries.map((entry) => (
							<li
								key={entry.id}
								className="flex flex-col gap-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800"
							>
								<EntryHeader entry={entry} />
								{entry.kind === "script" ? (
									<ScriptPreview script={entry.script} />
								) : (
									<ol className="flex list-decimal flex-col gap-2 pl-5">
										{entry.options.map((option, index) => (
											<li
												// biome-ignore lint/suspicious/noArrayIndexKey: lista gravada, não muda.
												key={index}
												className="whitespace-pre-wrap"
											>
												{option}
											</li>
										))}
									</ol>
								)}
							</li>
						))}
					</ol>
				)}
			</div>
		</BottomSheet>
	);
}

function EntryHeader({ entry }: { entry: HistoryEntryDto }) {
	const title =
		entry.kind === "script"
			? "Roteiro completo"
			: `Opções de ${SCRIPT_FIELD_LABEL[entry.field].name}`;
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<h3 className="font-semibold">{title}</h3>
			<p className="text-sm text-zinc-600 dark:text-zinc-400">
				{entry.createdByKind === "agency" ? "Agência" : "Cliente"} ·{" "}
				<time dateTime={entry.createdAt}>
					{when.format(new Date(entry.createdAt))}
				</time>
			</p>
		</div>
	);
}
