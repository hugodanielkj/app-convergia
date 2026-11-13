import { createFileRoute } from "@tanstack/react-router";
import { meQuery } from "../../../api/queries";
import { IdeasPage } from "../../../features/ideias/ideas-page";
export const Route = createFileRoute("/empresas/$companyId/ideias")({
	loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
	component: Page,
});
function Page() {
	const me = Route.useLoaderData();
	return (
		<IdeasPage
			companyId={Route.useParams().companyId}
			isAgency={me.kind === "agency_member"}
		/>
	);
}
