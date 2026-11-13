import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { meQuery } from "../../../api/queries";
import { SoonBadge } from "../../../components/soon-badge";
import { InstagramPanel } from "../../../features/desempenho/instagram-panel";

export const Route = createFileRoute("/empresas/$companyId/desempenho")({
	// A volta da Meta traz o resultado da conexão na URL.
	validateSearch: z.object({
		instagram: z.literal("conectado").optional().catch(undefined),
		instagram_erro: z.string().max(300).optional().catch(undefined),
	}),
	component: Performance,
});

function Performance() {
	const { companyId } = Route.useParams();
	const search = Route.useSearch();
	const { data: me } = useSuspenseQuery(meQuery);

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-3xl font-medium">Desempenho</h1>
			{search.instagram === "conectado" && (
				<p
					role="status"
					className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
				>
					Instagram conectado. A IA já usa o perfil e os posts recentes nos
					roteiros.
				</p>
			)}
			{search.instagram_erro && (
				<p
					role="alert"
					className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
				>
					{search.instagram_erro}
				</p>
			)}
			<InstagramPanel
				companyId={companyId}
				isAgency={me.kind === "agency_member"}
			/>
			<div className="flex items-center gap-2 rounded-2xl border border-dashed border-zinc-300 p-4 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
				<span className="flex-1">Métricas e insights dos posts</span>
				<SoonBadge />
			</div>
		</div>
	);
}
