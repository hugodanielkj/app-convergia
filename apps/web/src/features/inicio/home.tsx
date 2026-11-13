import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CalendarDays,
	ChevronRight,
	CircleCheckBig,
	FileText,
	Lightbulb,
} from "lucide-react";
import { errorMessage } from "../../api/client";
import { calendarQuery } from "../../api/queries";

import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
import { addDays, todayIso } from "../../lib/dates";
import { ContentCard } from "../conteudo/content-card";
import { useOpenNewContent } from "../conteudo/new-content";

/** Tela Início: atalhos grandes para as ações principais (RN-006, design §13.2). */
export function Home({ companyId }: { companyId: string }) {
	return (
		<div className="flex flex-col gap-6">
			<section aria-labelledby="atalhos" className="flex flex-col gap-3">
				<h1 id="atalhos" className="text-3xl font-medium">
					O que vamos fazer hoje?
				</h1>
				<div className="grid gap-3 sm:grid-cols-2">
					<Link
						to="/empresas/$companyId/roteiros/novo"
						params={{ companyId }}
						className="flex min-h-24 flex-col justify-between gap-3 rounded-3xl bg-brand-600 p-4 text-white active:scale-[0.99] sm:col-span-2"
					>
						<div className="flex items-start justify-between gap-2">
							<FileText className="size-7" aria-hidden />
							<ChevronRight className="size-5 text-brand-100" aria-hidden />
						</div>
						<div>
							<p className="text-lg font-semibold">Criar roteiro</p>
							<p className="text-sm text-brand-100">
								A IA escreve a partir de um tema ou de um texto seu.
							</p>
						</div>
					</Link>
					<Link
						to="/empresas/$companyId/ideias"
						params={{ companyId }}
						className="flex min-h-24 flex-col justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
					>
						<div className="flex items-start justify-between gap-2">
							<Lightbulb className="size-7 text-brand-600" aria-hidden />
							<ChevronRight className="size-5" aria-hidden />
						</div>
						<p className="font-semibold">Ideias para a semana</p>
					</Link>
					<Link
						to="/empresas/$companyId/aprovacoes"
						params={{ companyId }}
						className="flex min-h-24 flex-col justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 active:scale-[0.99] dark:bg-zinc-900 dark:ring-zinc-800"
					>
						<div className="flex items-start justify-between gap-2">
							<CircleCheckBig className="size-7 text-brand-600" aria-hidden />
							<ChevronRight className="size-5 text-zinc-400" aria-hidden />
						</div>
						<p className="font-semibold">Aprovações pendentes</p>
					</Link>
				</div>
			</section>

			<section aria-labelledby="proximos" className="flex flex-col gap-3">
				<h2 id="proximos" className="text-xl font-medium">
					Próximos posts
				</h2>
				<UpcomingPosts companyId={companyId} />
			</section>
		</div>
	);
}

/** Próximos 7 dias do calendário (RN-062). */
function UpcomingPosts({ companyId }: { companyId: string }) {
	const today = todayIso();
	const query = useQuery(calendarQuery(companyId, today, addDays(today, 6)));
	const openNewContent = useOpenNewContent();

	if (query.isPending) return <SkeletonList rows={2} />;
	if (query.isError) return <ErrorState message={errorMessage(query.error)} />;
	if (query.data.contents.length === 0) {
		return (
			<EmptyState icon={CalendarDays} title="Nenhum post nos próximos 7 dias">
				<button
					type="button"
					onClick={() => openNewContent(today)}
					className="mt-1 min-h-11 rounded-full px-4 font-semibold text-brand-700 dark:text-brand-300"
				>
					Planejar um post para hoje
				</button>
			</EmptyState>
		);
	}
	return (
		<ul className="flex flex-col gap-2">
			{[...query.data.contents]
				.sort((a, b) =>
					(a.plannedDate ?? "").localeCompare(b.plannedDate ?? ""),
				)
				.map((content) => (
					<li key={content.id}>
						<ContentCard content={content} showStatus />
					</li>
				))}
		</ul>
	);
}
