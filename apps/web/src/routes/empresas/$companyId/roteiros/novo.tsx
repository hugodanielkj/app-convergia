import { createFileRoute } from "@tanstack/react-router";
import { CreateScript } from "../../../../features/roteiros/create-script";

export const Route = createFileRoute("/empresas/$companyId/roteiros/novo")({
	component: () => <CreateScript companyId={Route.useParams().companyId} />,
});
