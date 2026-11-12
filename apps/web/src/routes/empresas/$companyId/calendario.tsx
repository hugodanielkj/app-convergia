import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "../../../components/states";

export const Route = createFileRoute("/empresas/$companyId/calendario")({
	component: () => (
		<div className="flex flex-col gap-4">
			<h1 className="text-2xl font-bold">Calendário</h1>
			<EmptyState
				icon={CalendarDays}
				title="O calendário editorial está a caminho"
			>
				Cards, kanban e calendário chegam na próxima etapa do app.
			</EmptyState>
		</div>
	),
});
