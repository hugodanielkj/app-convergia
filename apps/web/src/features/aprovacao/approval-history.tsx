import type { ApprovalEventDto } from "../../api/client";
import { EVENT_LABEL, momentLabel } from "./labels";

/** ✅ RN-230: quem fez o quê, quando e com qual motivo. */
export function ApprovalHistory({ events }: { events: ApprovalEventDto[] }) {
	if (events.length === 0) {
		return (
			<p className="text-sm text-zinc-600 dark:text-zinc-400">
				Este roteiro ainda não foi enviado para aprovação.
			</p>
		);
	}
	return (
		<ol className="flex flex-col gap-3 border-l-2 border-zinc-200 pl-4 dark:border-zinc-800">
			{[...events].reverse().map((event) => (
				<li key={event.id} className="flex flex-col gap-0.5">
					<span className="text-sm font-medium">{EVENT_LABEL[event.type]}</span>
					<span className="text-xs text-zinc-600 dark:text-zinc-400">
						{momentLabel(event.at)}
						{event.actorName && ` · ${event.actorName}`} · versão{" "}
						{event.itemVersion}
					</span>
					{event.reason && (
						<span className="text-sm text-zinc-700 dark:text-zinc-300">
							“{event.reason}”
						</span>
					)}
				</li>
			))}
		</ol>
	);
}
