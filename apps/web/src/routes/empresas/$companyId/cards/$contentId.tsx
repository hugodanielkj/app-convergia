import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { errorMessage } from "../../../../api/client";
import { contentQuery } from "../../../../api/queries";
import { ErrorState, SkeletonList } from "../../../../components/states";
import { ContentEditor } from "../../../../features/conteudo/content-editor";

export const Route = createFileRoute("/empresas/$companyId/cards/$contentId")({
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
		const { data } = useSuspenseQuery(contentQuery(companyId, contentId));
		return <ContentEditor content={data} />;
	},
});
