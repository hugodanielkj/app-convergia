import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { errorMessage } from "../../api/client";
import { calendarQuery } from "../../api/queries";
import { ErrorState, SkeletonList } from "../../components/states";
import { cn } from "../../lib/cn";
import {
	addDays,
	dayLabel,
	todayIso,
	weekDays,
	weekLabel,
} from "../../lib/dates";
import { ContentCard } from "./content-card";
import { useOpenNewContent } from "./new-content";

/** Calendário no celular: a semana com os dias empilhados (design §13.2). */
export function WeekView({
	companyId,
	weekStart,
	onWeekChange,
}: {
	companyId: string;
	weekStart: string;
	onWeekChange: (start: string) => void;
}) {
	const days = weekDays(weekStart);
	const query = useQuery(
		calendarQuery(companyId, weekStart, addDays(weekStart, 6)),
	);
	const openNewContent = useOpenNewContent();
	const today = todayIso();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => onWeekChange(addDays(weekStart, -7))}
					aria-label="Semana anterior"
					className="flex size-11 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
				>
					<ChevronLeft className="size-5" aria-hidden />
				</button>
				<p className="flex-1 text-center font-semibold">
					{weekLabel(weekStart)}
				</p>
				<button
					type="button"
					onClick={() => onWeekChange(addDays(weekStart, 7))}
					aria-label="Próxima semana"
					className="flex size-11 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
				>
					<ChevronRight className="size-5" aria-hidden />
				</button>
			</div>

			{query.isPending ? (
				<SkeletonList rows={4} />
			) : query.isError ? (
				<ErrorState message={errorMessage(query.error)} />
			) : (
				<ol className="flex flex-col gap-5">
					{days.map((day) => {
						const cards = query.data.contents.filter(
							(c) => c.plannedDate === day,
						);
						return (
							<li key={day} className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<h3
										className={cn(
											"text-sm font-semibold",
											day === today
												? "text-brand-700 dark:text-brand-300"
												: "text-zinc-700 dark:text-zinc-300",
										)}
									>
										{dayLabel(day)}
										{day === today && " · hoje"}
									</h3>
									<button
										type="button"
										onClick={() => openNewContent(day)}
										aria-label={`Novo card em ${dayLabel(day)}`}
										className="flex size-11 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900"
									>
										<Plus className="size-5" aria-hidden />
									</button>
								</div>
								{cards.length === 0 ? (
									<p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700">
										Nada planejado.
									</p>
								) : (
									cards.map((content) => (
										<ContentCard
											key={content.id}
											content={content}
											showStatus
										/>
									))
								)}
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}
