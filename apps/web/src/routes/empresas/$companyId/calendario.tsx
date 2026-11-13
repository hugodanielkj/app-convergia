import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { KanbanView } from "../../../features/conteudo/kanban-view";
import { WeekView } from "../../../features/conteudo/week-view";
import { cn } from "../../../lib/cn";
import { startOfWeek, todayIso } from "../../../lib/dates";

const search = z.object({
	view: z.enum(["semana", "kanban"]).catch("semana"),
	semana: z.iso.date().optional().catch(undefined),
});

export const Route = createFileRoute("/empresas/$companyId/calendario")({
	validateSearch: search,
	component: Calendar,
});

const VIEWS = [
	{ id: "semana", label: "Semana" },
	{ id: "kanban", label: "Kanban" },
] as const;

function Calendar() {
	const { companyId } = Route.useParams();
	const { view, semana } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const weekStart = startOfWeek(semana ?? todayIso());

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">Calendário</h1>
				<div
					role="tablist"
					aria-label="Visualização"
					className="flex rounded-full bg-zinc-200/70 p-1 dark:bg-zinc-800"
				>
					{VIEWS.map(({ id, label }) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={view === id}
							onClick={() =>
								void navigate({ search: (s) => ({ ...s, view: id }) })
							}
							className={cn(
								"min-h-10 rounded-full px-4 text-sm font-medium",
								view === id
									? "bg-white shadow-sm dark:bg-zinc-950"
									: "text-zinc-600 dark:text-zinc-400",
							)}
						>
							{label}
						</button>
					))}
				</div>
			</div>
			{view === "kanban" ? (
				<KanbanView companyId={companyId} />
			) : (
				<WeekView
					companyId={companyId}
					weekStart={weekStart}
					onWeekChange={(start) =>
						void navigate({ search: (s) => ({ ...s, semana: start }) })
					}
				/>
			)}
		</div>
	);
}
