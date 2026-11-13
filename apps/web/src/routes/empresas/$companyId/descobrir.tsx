import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DiscoverPage } from "../../../features/descoberta/discover-page";

/** A pesquisa fica na URL: voltar, recarregar e compartilhar mantêm o que se viu. */
const search = z.object({
	q: z.string().max(200).optional().catch(undefined),
	plataforma: z
		.enum(["all", "instagram", "tiktok"])
		.optional()
		.catch(undefined),
	periodo: z.enum(["7d", "30d", "any"]).optional().catch(undefined),
	ordem: z
		.enum(["relevance", "popularity", "recent"])
		.optional()
		.catch(undefined),
	pesquisa: z.string().max(100).optional().catch(undefined),
});

export const Route = createFileRoute("/empresas/$companyId/descobrir")({
	validateSearch: search,
	component: Discover,
});

function Discover() {
	const { companyId } = Route.useParams();
	const navigate = Route.useNavigate();
	return (
		<DiscoverPage
			companyId={companyId}
			search={Route.useSearch()}
			onSearchChange={(next) => void navigate({ search: next, replace: false })}
		/>
	);
}
