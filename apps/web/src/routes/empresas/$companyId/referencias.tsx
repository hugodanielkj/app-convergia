import { createFileRoute } from "@tanstack/react-router";
import { ReferencesPage } from "../../../features/referencias/references-page";
export const Route = createFileRoute("/empresas/$companyId/referencias")({
	component: () => <ReferencesPage companyId={Route.useParams().companyId} />,
});
