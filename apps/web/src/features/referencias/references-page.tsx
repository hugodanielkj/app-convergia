import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "../../api/client";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
export function ReferencesPage({ companyId }: { companyId: string }) {
	const [url, setUrl] = useState("");
	const cache = useQueryClient();
	const list = useQuery({
		queryKey: ["companies", companyId, "references"],
		queryFn: () => api.references(companyId),
		refetchInterval: (q) =>
			q.state.data?.references.some(
				(r) => r.status === "queued" || r.analysisStatus === "queued",
			)
				? 2000
				: false,
	});
	const change = useMutation({
		mutationFn: async (action: {
			type: "save" | "delete" | "analyze";
			id?: string;
			url?: string;
		}) => {
			if (action.type === "save")
				await api.saveReference(companyId, action.url ?? url);
			else if (action.id) {
				if (action.type === "delete")
					await api.deleteReference(companyId, action.id);
				else await api.creatorAnalysis(companyId, action.id);
			}
		},
		onSuccess: () =>
			cache.invalidateQueries({
				queryKey: ["companies", companyId, "references"],
			}),
	});
	const [deleting, setDeleting] = useState<string | null>(null);
	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-3xl font-medium">Referências</h1>
			<p>Posts e perfis públicos do Instagram que inspiram a criação.</p>
			<p className="text-sm text-zinc-600 dark:text-zinc-300">
				1 criador por empresa. Até 3 referências salvas e 3 análises novas por
				dia. Consultar a análise salva não consome cota.
			</p>
			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					change.mutate({ type: "save" });
				}}
			>
				<label htmlFor="reference-url">Link público do Instagram</label>
				<input
					id="reference-url"
					type="url"
					inputMode="url"
					autoComplete="url"
					required
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					className="min-h-11 rounded-xl border border-zinc-300 p-3 text-base dark:bg-zinc-900"
				/>
				<button
					type="submit"
					disabled={change.isPending || !url.trim()}
					className="min-h-11 rounded-full bg-brand-600 px-4 font-semibold text-white"
				>
					Salvar referência
				</button>
			</form>
			{change.isError && <p role="alert">{errorMessage(change.error)}</p>}
			{list.isPending ? (
				<SkeletonList rows={3} />
			) : list.isError ? (
				<ErrorState message={errorMessage(list.error)} />
			) : !list.data.references.length ? (
				<EmptyState icon={Bookmark} title="Nenhuma referência salva">
					As referências da empresa aparecerão aqui.
				</EmptyState>
			) : (
				<ul className="flex flex-col gap-3">
					{list.data.references.map((r) => (
						<li
							key={r.id}
							className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900"
						>
							<a
								href={r.url}
								target="_blank"
								rel="noreferrer"
								className="break-all underline"
							>
								{r.url}
							</a>
							<p>
								{r.analysisStatus === "failed"
									? r.error
									: r.status === "queued"
										? "Processando..."
										: r.status === "failed"
											? r.error
											: "Pronta"}
							</p>
							{r.summary && <p className="whitespace-pre-wrap">{r.summary}</p>}
							{r.text && (
								<details>
									<summary className="min-h-11 cursor-pointer py-3">
										Texto coletado
									</summary>
									<p className="whitespace-pre-wrap">{r.text}</p>
								</details>
							)}
							{r.analysisStatus === "queued" && (
								<p role="status">Analisando criador...</p>
							)}
							{r.status === "failed" && (
								<button
									type="button"
									className="min-h-11 rounded-full px-4 ring-1 ring-zinc-300"
									disabled={change.isPending}
									onClick={() => change.mutate({ type: "save", url: r.url })}
								>
									Tentar coleta novamente
								</button>
							)}
							{r.analysis && (
								<p className="whitespace-pre-wrap">{r.analysis}</p>
							)}
							{r.kind === "creator" && (
								<button
									type="button"
									className="min-h-11 rounded-full px-4 ring-1 ring-zinc-300"
									disabled={
										change.isPending ||
										r.status !== "ready" ||
										r.analysisStatus === "queued"
									}
									onClick={() => change.mutate({ type: "analyze", id: r.id })}
								>
									{r.analysis ? "Consultar análise salva" : "Analisar criador"}
								</button>
							)}
							<button
								type="button"
								className="min-h-11 rounded-full px-4 ring-1 ring-zinc-300"
								onClick={() => setDeleting(r.id)}
							>
								Excluir referência
							</button>
							{deleting === r.id && (
								<fieldset aria-label="Confirmar exclusão">
									<p>A exclusão é definitiva. Excluir esta referência?</p>
									<button
										type="button"
										className="min-h-11 px-4"
										disabled={change.isPending}
										onClick={() => {
											change.mutate({ type: "delete", id: r.id });
											setDeleting(null);
										}}
									>
										Excluir definitivamente
									</button>
									<button
										type="button"
										className="min-h-11 px-4"
										onClick={() => setDeleting(null)}
									>
										Cancelar
									</button>
								</fieldset>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
