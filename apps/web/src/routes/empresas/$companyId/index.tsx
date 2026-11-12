import { createFileRoute } from "@tanstack/react-router";
import { Home } from "../../../features/inicio/home";

export const Route = createFileRoute("/empresas/$companyId/")({
	component: () => <Home companyId={Route.useParams().companyId} />,
});
