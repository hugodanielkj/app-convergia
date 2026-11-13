import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Bookmark,
	ChartColumn,
	ChevronRight,
	Compass,
	Images,
	Lightbulb,
	LogOut,
	type LucideIcon,
	Trash2,
	UserRound,
} from "lucide-react";
import { SoonBadge } from "../../../components/soon-badge";
import { clearDevApiKey } from "../../../lib/dev-session";

export const Route = createFileRoute("/empresas/$companyId/mais")({
	component: More,
});

const SECTIONS: { label: string; icon: LucideIcon }[] = [
	{ label: "Desempenho", icon: ChartColumn },
	{ label: "Ideias", icon: Lightbulb },
	{ label: "Referências", icon: Bookmark },
	{ label: "Carrossel", icon: Images },
	{ label: "Conta", icon: UserRound },
];

function More() {
	const navigate = useNavigate();
	const { queryClient } = Route.useRouteContext();

	function signOut() {
		clearDevApiKey();
		queryClient.clear();
		void navigate({ to: "/entrar" });
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-3xl font-medium">Mais</h1>
			<Link
				to="/empresas/$companyId/descobrir"
				params={{ companyId: Route.useParams().companyId }}
				className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
			>
				<Compass className="size-5 text-brand-600" aria-hidden />
				<span className="flex-1">Descobrir vídeos</span>
				<ChevronRight className="size-5 text-zinc-400" aria-hidden />
			</Link>
			<ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
				{SECTIONS.map(({ label, icon: Icon }) => (
					<li
						key={label}
						className="flex min-h-14 items-center gap-3 px-4"
						aria-disabled="true"
					>
						<Icon className="size-5 text-zinc-500" aria-hidden />
						<span className="flex-1">{label}</span>
						<SoonBadge />
					</li>
				))}
			</ul>
			<Link
				to="/empresas/$companyId/lixeira"
				params={{ companyId: Route.useParams().companyId }}
				className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
			>
				<Trash2 className="size-5 text-zinc-500" aria-hidden />
				<span className="flex-1">Lixeira</span>
				<ChevronRight className="size-5 text-zinc-400" aria-hidden />
			</Link>
			<button
				type="button"
				onClick={signOut}
				className="flex min-h-12 items-center justify-center gap-2 rounded-2xl font-medium text-red-700 ring-1 ring-zinc-200 hover:bg-red-50 dark:text-red-300 dark:ring-zinc-800 dark:hover:bg-red-950"
			>
				<LogOut className="size-5" aria-hidden />
				Sair
			</button>
		</div>
	);
}
