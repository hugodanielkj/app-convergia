import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, CalendarDays } from "lucide-react";
import type { ContentDto } from "../../api/client";
import { shortDate } from "../../lib/dates";
import { APPROVAL_BADGE, MEDIA_TYPE_LABEL, STATUS_LABEL } from "./labels";

/** Card resumido nas listas do calendário e do kanban. */
export function ContentCard({
	content,
	onMove,
	showStatus = false,
}: {
	content: ContentDto;
	onMove?: () => void;
	showStatus?: boolean;
}) {
	const approval = APPROVAL_BADGE[content.approvalStatus];
	return (
		<div className="flex items-stretch rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
			<Link
				to="/empresas/$companyId/cards/$contentId"
				params={{ companyId: content.companyId, contentId: content.id }}
				className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3 active:opacity-70"
			>
				<span className="line-clamp-2 font-medium">{content.title}</span>
				<span className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
					{showStatus && <span>{STATUS_LABEL[content.status]}</span>}
					{content.mediaType && (
						<span>{MEDIA_TYPE_LABEL[content.mediaType]}</span>
					)}
					{content.plannedDate && (
						<span className="flex items-center gap-1">
							<CalendarDays className="size-3.5" aria-hidden />
							{shortDate(content.plannedDate)}
						</span>
					)}
					{approval && (
						<span
							className={`rounded-full px-2 py-0.5 font-medium ${approval.className}`}
						>
							{approval.label}
						</span>
					)}
				</span>
			</Link>
			{onMove && (
				<button
					type="button"
					onClick={onMove}
					aria-label={`Mover ${content.title}`}
					className="flex w-12 shrink-0 items-center justify-center border-l border-zinc-200 text-zinc-500 dark:border-zinc-800"
				>
					<ArrowRightLeft className="size-5" aria-hidden />
				</button>
			)}
		</div>
	);
}
