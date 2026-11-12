import { Link } from "@tanstack/react-router";
import {
	CalendarDays,
	ChevronRight,
	CircleCheckBig,
	FileText,
	Lightbulb,
} from "lucide-react";
import { SoonBadge } from "../../components/soon-badge";
import { EmptyState } from "../../components/states";

/** Tela Início: atalhos grandes para as ações principais (RN-006, design §13.2). */
export function Home({ companyId }: { companyId: string }) {
	return (
		<div className="flex flex-col gap-6">
			<section aria-labelledby="atalhos" className="flex flex-col gap-3">
				<h1 id="atalhos" className="text-2xl font-bold">
					O que vamos fazer hoje?
				</h1>
				<div className="grid gap-3 sm:grid-cols-2">
					<div
						aria-disabled="true"
						className="flex min-h-24 flex-col justify-between gap-3 rounded-3xl bg-brand-600 p-4 text-white sm:col-span-2"
					>
						<div className="flex items-start justify-between gap-2">
							<FileText className="size-7" aria-hidden />
							<span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
								Em breve
							</span>
						</div>
						<div>
							<p className="text-lg font-semibold">Criar roteiro</p>
							<p className="text-sm text-brand-100">
								A IA escreve a partir de um tema ou de um texto seu.
							</p>
						</div>
					</div>
					<div
						aria-disabled="true"
						className="flex min-h-24 flex-col justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
					>
						<div className="flex items-start justify-between gap-2">
							<Lightbulb className="size-7 text-brand-600" aria-hidden />
							<SoonBadge />
						</div>
						<p className="font-semibold">Ideias para a semana</p>
					</div>
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
				<h2 id="proximos" className="text-lg font-semibold">
					Próximos posts
				</h2>
				<EmptyState icon={CalendarDays} title="Nenhum post planejado ainda">
					O calendário editorial chega na próxima etapa do app.
				</EmptyState>
			</section>
		</div>
	);
}
