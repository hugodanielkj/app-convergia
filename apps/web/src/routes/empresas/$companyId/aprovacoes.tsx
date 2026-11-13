import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { meQuery } from "../../../api/queries";
import { ApprovalsPage } from "../../../features/aprovacao/approvals-page";

export const Route = createFileRoute("/empresas/$companyId/aprovacoes")({
	component: () => {
		const { companyId } = Route.useParams();
		const { data: me } = useSuspenseQuery(meQuery);
		return (
			<ApprovalsPage
				companyId={companyId}
				isAgency={me.kind === "agency_member"}
			/>
		);
	},
});
