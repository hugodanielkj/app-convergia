import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { errorMessage } from "../../../api/client";
import { companyQuery, meQuery } from "../../../api/queries";
import { AppShell } from "../../../components/app-shell";
import { ErrorState, SkeletonList } from "../../../components/states";
import { requireUser } from "../../../lib/require-user";

/** Tudo dentro de uma empresa. A empresa vem da URL e o servidor confere o acesso (RN-022). */
export const Route = createFileRoute("/empresas/$companyId")({
	beforeLoad: ({ context }) => requireUser(context.queryClient),
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(companyQuery(params.companyId)),
	pendingComponent: () => (
		<div className="mx-auto max-w-3xl p-4">
			<SkeletonList rows={4} />
		</div>
	),
	errorComponent: ({ error }) => (
		<div className="mx-auto max-w-md p-4 pt-16">
			<ErrorState
				message={errorMessage(error)}
				action={
					<Link to="/" className="font-semibold underline">
						Voltar ao início
					</Link>
				}
			/>
		</div>
	),
	component: CompanyLayout,
});

function CompanyLayout() {
	const { companyId } = Route.useParams();
	const { data: company } = useSuspenseQuery(companyQuery(companyId));
	const { data: me } = useSuspenseQuery(meQuery);

	return (
		<AppShell
			companyId={company.id}
			companyName={company.name}
			canSwitchCompany={me.kind === "agency_member"}
		>
			<Outlet />
		</AppShell>
	);
}
