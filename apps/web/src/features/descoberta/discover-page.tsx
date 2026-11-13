import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CircleAlert,
	Clock,
	Compass,
	LoaderCircle,
	Search,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import {
	api,
	errorMessage,
	type VideoSearchDto,
	type VideoSort,
} from "../../api/client";
import { videoSearchQuery } from "../../api/queries";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
import { cn } from "../../lib/cn";
import { VideoCard } from "./video-card";

export type PlatformFilter = "all" | "instagram" | "tiktok";
export type Period = "7d" | "30d" | "any";

export type DiscoverSearch = {
	q?: string | undefined;
	plataforma?: PlatformFilter | undefined;
	periodo?: Period | undefined;
	ordem?: VideoSort | undefined;
	pesquisa?: string | undefined;
};

const PLATFORMS: { id: PlatformFilter; label: string }[] = [
	{ id: "all", label: "Todas" },
	{ id: "instagram", label: "Instagram" },
	{ id: "tiktok", label: "TikTok" },
];
const PERIODS: { id: Period; label: string }[] = [
	{ id: "7d", label: "7 dias" },
	{ id: "30d", label: "30 dias" },
	{ id: "any", label: "Qualquer data" },
];
const SORTS: { id: VideoSort; label: string }[] = [
	{ id: "relevance", label: "Relevância" },
	{ id: "popularity", label: "Popularidade" },
	{ id: "recent", label: "Mais recentes" },
];
const EXAMPLES = [
	"como criar vídeos com IA",
	"receitas fáceis para o dia a dia",
	"decoração de sala pequena",
];

const when = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "America/Sao_Paulo",
});

const selectClass =
	"min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-950";

/**
 * Descoberta de vídeos populares do Instagram Reels e do TikTok (✅ RN-110 a RN-119). A coleta
 * só começa no botão ou no Enter, nunca a cada tecla.
 */
export function DiscoverPage({
	companyId,
	search,
	onSearchChange,
}: {
	companyId: string;
	search: DiscoverSearch;
	onSearchChange: (next: DiscoverSearch) => void;
}) {
	const queryClient = useQueryClient();
	const platform = search.plataforma ?? "all";
	const period = search.periodo ?? "30d";
	const sort = search.ordem ?? "relevance";
	const [draft, setDraft] = useState(search.q ?? "");
	// Resposta sem pesquisa gravada (integração não configurada): não há o que consultar depois.
	const [unsaved, setUnsaved] = useState<VideoSearchDto | null>(null);

	const start = useMutation({
		mutationFn: (input: {
			query: string;
			platform: PlatformFilter;
			period: Period;
		}) => api.discoverVideos(companyId, { ...input, sort }),
		onSuccess: (view, input) => {
			if (view.requestId) {
				queryClient.setQueryData(
					videoSearchQuery(companyId, view.requestId, sort).queryKey,
					view,
				);
				setUnsaved(null);
			} else {
				setUnsaved(view);
			}
			onSearchChange({
				...search,
				q: input.query,
				plataforma: input.platform,
				periodo: input.period,
				pesquisa: view.requestId ?? undefined,
			});
		},
	});

	const results = useQuery({
		...videoSearchQuery(companyId, search.pesquisa ?? "", sort),
		enabled: Boolean(search.pesquisa),
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status === "collecting" || status === "refreshing" ? 2_000 : false;
		},
	});

	const run = (
		overrides: { platform?: PlatformFilter; period?: Period } = {},
	) => {
		const query = draft.replace(/\s+/g, " ").trim();
		if (query.length < 2 || start.isPending) return;
		start.mutate({
			query,
			platform: overrides.platform ?? platform,
			period: overrides.period ?? period,
		});
	};

	const submit = (event: FormEvent) => {
		event.preventDefault();
		run();
	};

	// Filtro de coleta muda a pesquisa: refaz uma vez, se já havia uma.
	const changeFilter = (next: {
		platform?: PlatformFilter;
		period?: Period;
	}) => {
		if (search.q && draft.trim().length >= 2) run(next);
		else
			onSearchChange({
				...search,
				plataforma: next.platform ?? platform,
				periodo: next.period ?? period,
			});
	};

	const view = unsaved ?? (search.pesquisa ? results.data : undefined);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-3xl font-medium">Descobrir vídeos</h1>
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					Vídeos reais e populares do Instagram Reels e do TikTok sobre um
					assunto.
				</p>
			</div>

			<form onSubmit={submit} className="flex gap-2">
				<label htmlFor="video-query" className="sr-only">
					Assunto
				</label>
				<input
					id="video-query"
					type="search"
					enterKeyHint="search"
					autoComplete="off"
					maxLength={200}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					placeholder="Ex.: como criar vídeos com IA"
					className="min-h-12 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-950"
				/>
				<button
					type="submit"
					disabled={draft.trim().length < 2 || start.isPending}
					className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white disabled:opacity-50"
				>
					{start.isPending ? (
						<LoaderCircle className="size-5 animate-spin" aria-hidden />
					) : (
						<Search className="size-5" aria-hidden />
					)}
					Pesquisar
				</button>
			</form>

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<fieldset className="flex gap-2">
					<legend className="sr-only">Plataforma</legend>
					{PLATFORMS.map((item) => (
						<button
							key={item.id}
							type="button"
							aria-pressed={platform === item.id}
							onClick={() => changeFilter({ platform: item.id })}
							disabled={start.isPending}
							className={cn(
								"min-h-11 rounded-full px-4 text-sm font-medium ring-1",
								platform === item.id
									? "bg-brand-600 text-white ring-brand-600"
									: "ring-zinc-300 dark:ring-zinc-700",
							)}
						>
							{item.label}
						</button>
					))}
				</fieldset>
				<div className="flex gap-2">
					<label className="flex flex-1 flex-col gap-1 text-xs font-medium md:flex-none">
						Período
						<select
							value={period}
							onChange={(event) =>
								changeFilter({ period: event.target.value as Period })
							}
							disabled={start.isPending}
							className={selectClass}
						>
							{PERIODS.map((item) => (
								<option key={item.id} value={item.id}>
									{item.label}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-1 flex-col gap-1 text-xs font-medium md:flex-none">
						Ordenar por
						<select
							value={sort}
							onChange={(event) =>
								onSearchChange({
									...search,
									ordem: event.target.value as VideoSort,
								})
							}
							className={selectClass}
						>
							{SORTS.map((item) => (
								<option key={item.id} value={item.id}>
									{item.label}
								</option>
							))}
						</select>
					</label>
				</div>
			</div>

			{start.error ? (
				<ErrorState message={errorMessage(start.error)} />
			) : view ? (
				<SearchResults key={`${search.pesquisa}-${sort}`} view={view} />
			) : search.pesquisa && results.isPending ? (
				<SkeletonList rows={4} />
			) : search.pesquisa && results.isError ? (
				<ErrorState message={errorMessage(results.error)} />
			) : (
				<EmptyState
					icon={Compass}
					title="Pesquise um assunto para ver vídeos populares"
				>
					<div className="mt-2 flex flex-wrap justify-center gap-2">
						{EXAMPLES.map((example) => (
							<button
								key={example}
								type="button"
								onClick={() => setDraft(example)}
								className="min-h-11 rounded-full bg-brand-50 px-3 text-sm font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100"
							>
								{example}
							</button>
						))}
					</div>
				</EmptyState>
			)}
		</div>
	);
}

function Notice({
	tone,
	children,
}: {
	tone: "info" | "warning";
	children: React.ReactNode;
}) {
	return (
		<p
			role={tone === "warning" ? "alert" : "status"}
			className={cn(
				"flex items-start gap-2 rounded-xl p-3 text-sm",
				tone === "warning"
					? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
					: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
			)}
		>
			{tone === "warning" ? (
				<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
			) : (
				<Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
			)}
			<span>{children}</span>
		</p>
	);
}

function SearchResults({ view }: { view: VideoSearchDto }) {
	// ✅ RN-119: só os vídeos mais bem colocados, sem "carregar mais".
	const videos = view.results;
	const updatedAt = view.updatedAt
		? when.format(new Date(view.updatedAt))
		: null;

	return (
		<section className="flex flex-col gap-3" aria-live="polite">
			{view.message && <Notice tone="warning">{view.message}</Notice>}
			{view.platformStatus
				.filter((item) => item.message)
				.map((item) => (
					<Notice key={item.platform} tone="warning">
						{item.message}
					</Notice>
				))}

			{view.status === "collecting" && (
				<div
					role="status"
					className="flex flex-col gap-2 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800"
				>
					<span className="flex items-center gap-2">
						<LoaderCircle className="size-4 animate-spin" aria-hidden />
						Coletando vídeos sobre este assunto...
					</span>
					{view.progress && view.progress.total > 0 && (
						<progress
							className="h-2 w-full"
							max={view.progress.total}
							value={view.progress.done}
							aria-label={`${view.progress.done} de ${view.progress.total} etapas`}
						/>
					)}
				</div>
			)}
			{view.status === "refreshing" && updatedAt && (
				<Notice tone="info">
					Atualizando em segundo plano. Mostrando a atualização de {updatedAt}.
				</Notice>
			)}
			{view.status === "ready" && view.stale && updatedAt && (
				<Notice tone="info">
					Resultados de uma atualização anterior ({updatedAt}).
				</Notice>
			)}

			{updatedAt && (
				<header className="flex flex-col gap-0.5">
					<h2 className="text-xl font-medium">{view.label}</h2>
					<p className="text-xs text-zinc-600 dark:text-zinc-400">
						Atualizado em {updatedAt}. Relevância estimada pela legenda;
						métricas públicas no momento da coleta.
					</p>
				</header>
			)}

			{videos.length > 0 ? (
				<ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{videos.map((video) => (
						<li key={video.id}>
							<VideoCard video={video} />
						</li>
					))}
				</ul>
			) : view.status === "ready" ? (
				<EmptyState icon={Search} title="Nenhum vídeo encontrado">
					Tente outras palavras ou um período maior.
				</EmptyState>
			) : null}
		</section>
	);
}
