import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { errorMessage } from "../../../api/client";
import { trashQuery } from "../../../api/queries";
import {
	EmptyState,
	ErrorState,
	SkeletonList,
} from "../../../components/states";
import { useContentMutations } from "../../../features/conteudo/mutations";

export const Route = createFileRoute("/empresas/$companyId/lixeira")({
	component: Trash,
});

const deletedAt = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
});

/** Lixeira: cards excluídos há até 30 dias (RN-069). */
function Trash() {
	const { companyId } = Route.useParams();
	const query = useQuery(trashQuery(companyId));
	const { restore } = useContentMutations(companyId);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-3xl font-medium">Lixeira</h1>
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					Cards excluídos ficam aqui por 30 dias.
				</p>
			</div>
			{restore.error && <ErrorState message={errorMessage(restore.error)} />}
			{query.isPending ? (
				<SkeletonList rows={3} />
			) : query.isError ? (
				<ErrorState message={errorMessage(query.error)} />
			) : query.data.contents.length === 0 ? (
				<EmptyState icon={Trash2} title="A lixeira está vazia" />
			) : (
				<ul className="flex flex-col gap-2">
					{query.data.contents.map((content) => (
						<li
							key={content.id}
							className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
						>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium">{content.title}</p>
								{content.deletedAt && (
									<p className="text-xs text-zinc-500">
										Excluído em {deletedAt.format(new Date(content.deletedAt))}
									</p>
								)}
							</div>
							<button
								type="button"
								disabled={restore.isPending}
								onClick={() => restore.mutate(content.id)}
								className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-60 dark:text-brand-300 dark:ring-brand-900"
							>
								<RotateCcw className="size-4" aria-hidden />
								Restaurar
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
