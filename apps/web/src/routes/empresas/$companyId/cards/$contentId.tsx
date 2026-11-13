import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { errorMessage } from "../../../../api/client";
import { contentQuery } from "../../../../api/queries";
import { ErrorState, SkeletonList } from "../../../../components/states";
import { ContentEditor } from "../../../../features/conteudo/content-editor";

export const Route = createFileRoute("/empresas/$companyId/cards/$contentId")({
	// `refinar` abre a conversa com a IA ao chegar do fluxo "Criar roteiro" (RN-006).
	validateSearch: z.object({
		refinar: z.boolean().optional().catch(undefined),
	}),
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(
			contentQuery(params.companyId, params.contentId),
		),
	pendingComponent: () => <SkeletonList rows={5} />,
	errorComponent: ({ error }) => {
		const { companyId } = Route.useParams();
		return (
			<ErrorState
				message={errorMessage(error)}
				action={
					<Link
						to="/empresas/$companyId/calendario"
						params={{ companyId }}
						search={{ view: "kanban" }}
						className="font-semibold underline"
					>
						Voltar ao kanban
					</Link>
				}
			/>
		);
	},
	component: () => {
		const { companyId, contentId } = Route.useParams();
		const { refinar } = Route.useSearch();
		const { data } = useSuspenseQuery(contentQuery(companyId, contentId));
		return <ContentEditor content={data} startRefining={refinar === true} />;
	},
});
