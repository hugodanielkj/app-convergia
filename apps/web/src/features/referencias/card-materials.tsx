import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorMessage } from "../../api/client";
import { ErrorState, SkeletonList } from "../../components/states";

const field =
	"min-h-11 rounded-xl border border-zinc-300 p-3 text-base dark:bg-zinc-900";
export function CardMaterials({
	companyId,
	contentId,
}: {
	companyId: string;
	contentId: string;
}) {
	const param = { companyId, contentId };
	const cache = useQueryClient();
	const [title, setTitle] = useState("");
	const [url, setUrl] = useState("");
	const [text, setText] = useState("");
	const refs = useQuery({
		queryKey: ["companies", companyId, "contents", contentId, "references"],
		queryFn: () => api.contentReferences(param),
	});
	const sources = useQuery({
		queryKey: ["companies", companyId, "contents", contentId, "sources"],
		queryFn: () => api.contentSources(param),
	});
	const mutation = useMutation({
		mutationFn: async (a: {
			type: "attach" | "detach" | "source";
			id?: string;
		}) => {
			if (a.type === "attach")
				await api.attachReference(param, { title, url, kind: "link" });
			else if (a.type === "source")
				await api.addSource(param, { kind: "text", text });
			else if (a.id) await api.detachReference(param, a.id);
		},
		onSuccess: () =>
			cache.invalidateQueries({
				queryKey: ["companies", companyId, "contents"],
			}),
	});
	return (
		<section className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900">
			<h2 className="text-xl font-medium">Fontes e referências</h2>
			<p className="text-sm text-zinc-600 dark:text-zinc-300">
				Anexar referências não gera análise e não muda a aprovação do roteiro.
			</p>
			{mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
			{refs.isPending ? (
				<SkeletonList rows={1} />
			) : refs.isError ? (
				<ErrorState message={errorMessage(refs.error)} />
			) : !refs.data.references.length ? (
				<p>Nenhuma referência anexada.</p>
			) : (
				<ul>
					{refs.data.references.map((r) => (
						<li
							key={r.id}
							className="flex min-h-11 items-center justify-between gap-2"
						>
							<a
								href={r.url}
								target="_blank"
								rel="noreferrer"
								className="min-w-0 break-words underline"
							>
								{r.title}
							</a>
							<button
								type="button"
								className="min-h-11 shrink-0 px-3"
								disabled={mutation.isPending}
								onClick={() => mutation.mutate({ type: "detach", id: r.id })}
							>
								Remover
							</button>
						</li>
					))}
				</ul>
			)}
			<form
				className="flex flex-col gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					mutation.mutate({ type: "attach" });
				}}
			>
				<label htmlFor="attachment-title">Nome da referência</label>
				<input
					id="attachment-title"
					required
					maxLength={200}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className={field}
				/>
				<label htmlFor="attachment-url">Link da referência</label>
				<input
					id="attachment-url"
					type="url"
					inputMode="url"
					autoComplete="url"
					required
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					className={field}
				/>
				<button
					type="submit"
					className="min-h-11 rounded-full px-4 font-semibold ring-1 ring-zinc-300"
					disabled={mutation.isPending}
				>
					Anexar referência
				</button>
			</form>
			{sources.isPending ? (
				<SkeletonList rows={1} />
			) : sources.isError ? (
				<ErrorState message={errorMessage(sources.error)} />
			) : (
				<ul>
					{sources.data.sources.map((s) => (
						<li key={s.id} className="whitespace-pre-wrap">
							{s.text ?? s.url ?? "PDF"} ·{" "}
							{s.status === "ready"
								? "Pronta"
								: s.status === "failed"
									? s.error
									: "Processando"}
						</li>
					))}
				</ul>
			)}
			<form
				className="flex flex-col gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					mutation.mutate({ type: "source" });
				}}
			>
				<label htmlFor="source-text">
					Texto de apoio (200 a 150.000 caracteres)
				</label>
				<textarea
					id="source-text"
					minLength={200}
					maxLength={150000}
					required
					value={text}
					onChange={(e) => setText(e.target.value)}
					className={field}
				/>
				<p className="text-sm text-zinc-600 dark:text-zinc-300">
					Adicionar e extrair fontes depende da definição dos limites de uso.
				</p>
				<button
					type="submit"
					disabled
					className="min-h-11 rounded-full px-4 ring-1 ring-zinc-300"
				>
					Adicionar fonte
				</button>
			</form>
		</section>
	);
}
