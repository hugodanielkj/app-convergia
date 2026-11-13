import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Building2, ChevronRight } from "lucide-react";
import { errorMessage } from "../../api/client";
import { companiesQuery } from "../../api/queries";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
import { requireUser } from "../../lib/require-user";

/** Agência escolhe a empresa cliente; a escolha vai para a URL (RN-022). */
export const Route = createFileRoute("/empresas/")({
	beforeLoad: async ({ context }) => {
		const me = await requireUser(context.queryClient);
		if (me.companyId) {
			throw redirect({
				to: "/empresas/$companyId",
				params: { companyId: me.companyId },
			});
		}
	},
	loader: ({ context }) => context.queryClient.ensureQueryData(companiesQuery),
	pendingComponent: () => (
		<Page>
			<SkeletonList rows={4} />
		</Page>
	),
	errorComponent: ({ error }) => (
		<Page>
			<ErrorState message={errorMessage(error)} />
		</Page>
	),
	component: Companies,
});

function Page({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
			<h1 className="text-3xl font-medium">Em qual empresa vamos trabalhar?</h1>
			{children}
		</div>
	);
}

function Companies() {
	const { data } = useSuspenseQuery(companiesQuery);

	return (
		<Page>
			{data.companies.length === 0 ? (
				<EmptyState icon={Building2} title="Nenhuma empresa cliente cadastrada">
					O cadastro de empresas chega com a tela Empresas.
				</EmptyState>
			) : (
				<ul className="flex flex-col gap-2">
					{data.companies.map((company) => (
						<li key={company.id}>
							<Link
								to="/empresas/$companyId"
								params={{ companyId: company.id }}
								className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-zinc-200 active:scale-[0.99] dark:bg-zinc-900 dark:ring-zinc-800"
							>
								<span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-100">
									<Building2 className="size-5" aria-hidden />
								</span>
								<span className="min-w-0 flex-1 truncate font-medium">
									{company.name}
								</span>
								<ChevronRight className="size-5 text-zinc-400" aria-hidden />
							</Link>
						</li>
					))}
				</ul>
			)}
		</Page>
	);
}
