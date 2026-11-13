import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lightbulb } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "../../api/client";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";

const button =
	"min-h-11 rounded-full bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60";
const statusLabel = {
	none: "Criada por você",
	in_preparation: "Enviar em Aprovações",
	pending: "Aguardando aprovação",
	approved: "Aprovada",
	rejected: "Recusada",
};
export function IdeasPage({
	companyId,
	isAgency,
}: {
	companyId: string;
	isAgency: boolean;
}) {
	const [brief, setBrief] = useState("");
	const cache = useQueryClient();
	const navigate = useNavigate();
	const list = useQuery({
		queryKey: ["companies", companyId, "ideas"],
		queryFn: () => api.ideas(companyId),
	});
	const mutation = useMutation({
		mutationFn: async (action: {
			type: "generate" | "accept" | "dismiss";
			id?: string;
		}) => {
			if (action.type === "generate")
				await api.regenerateIdeas(companyId, brief);
			else if (action.id) {
				if (action.type === "accept")
					return api.acceptIdea(companyId, action.id);
				else await api.dismissIdea(companyId, action.id);
			}
		},
		onSuccess: async (card) => {
			await cache.invalidateQueries({ queryKey: ["companies", companyId] });
			if (card)
				await navigate({
					to: "/empresas/$companyId/cards/$contentId",
					params: { companyId, contentId: card.id },
				});
		},
	});
	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-3xl font-medium">Ideias para a semana</h1>
				<p className="text-zinc-600 dark:text-zinc-300">
					Conte o que sua empresa quer comunicar. A IA sugere caminhos e explica
					o motivo.
				</p>
			</div>
			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					mutation.mutate({ type: "generate" });
				}}
			>
				<label htmlFor="brief">Tema, público e objetivo</label>
				<textarea
					id="brief"
					required
					maxLength={5000}
					value={brief}
					onChange={(e) => setBrief(e.target.value)}
					className="min-h-28 rounded-xl border border-zinc-300 bg-white p-3 text-base dark:bg-zinc-900"
				/>
				<p className="text-sm text-zinc-600 dark:text-zinc-300">
					5 gerações por empresa por dia. Gerar novamente substitui as sugestões
					ativas.
				</p>
				<button
					type="submit"
					disabled={mutation.isPending || !brief.trim()}
					className={button}
				>
					{mutation.isPending ? "Processando..." : "Gerar ideias"}
				</button>
			</form>
			{mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
			{isAgency && (
				<p>
					As ideias da agência precisam da aprovação do cliente antes de virar
					card.
				</p>
			)}
			{list.isPending ? (
				<SkeletonList rows={3} />
			) : list.isError ? (
				<ErrorState message={errorMessage(list.error)} />
			) : !list.data.ideas.length ? (
				<EmptyState icon={Lightbulb} title="Nenhuma ideia ainda">
					Preencha o tema acima e gere suas primeiras sugestões.
				</EmptyState>
			) : (
				<ul className="flex flex-col gap-4">
					{list.data.ideas.map((idea) => (
						<li
							key={idea.id}
							className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900"
						>
							<h2 className="text-xl font-medium">{idea.title}</h2>
							<p className="whitespace-pre-wrap">{idea.text}</p>
							<p className="text-sm text-zinc-600 dark:text-zinc-300">
								Por que funciona: {idea.reason}
							</p>
							<p className="text-sm">{statusLabel[idea.approvalStatus]}</p>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									className={button}
									disabled={
										mutation.isPending ||
										!["none", "approved"].includes(idea.approvalStatus)
									}
									onClick={() =>
										mutation.mutate({ type: "accept", id: idea.id })
									}
								>
									Virar card
								</button>
								<button
									type="button"
									className="min-h-11 rounded-full px-4 ring-1 ring-zinc-300"
									disabled={mutation.isPending}
									onClick={() =>
										mutation.mutate({ type: "dismiss", id: idea.id })
									}
								>
									Descartar
								</button>
								{idea.approvalStatus !== "none" && (
									<Link
										to="/empresas/$companyId/aprovacoes"
										params={{ companyId }}
										className="flex min-h-11 items-center px-4 underline"
									>
										Ver aprovação
									</Link>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
