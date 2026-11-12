import { createFileRoute } from "@tanstack/react-router";
import { CircleCheckBig } from "lucide-react";
import { EmptyState } from "../../../components/states";

export const Route = createFileRoute("/empresas/$companyId/aprovacoes")({
	component: () => (
		<div className="flex flex-col gap-4">
			<h1 className="text-2xl font-bold">Aprovações</h1>
			<EmptyState icon={CircleCheckBig} title="Nada para aprovar">
				Os conteúdos enviados para aprovação aparecem aqui.
			</EmptyState>
		</div>
	),
});
