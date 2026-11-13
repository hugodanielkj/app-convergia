import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { DiscoverPage, type DiscoverSearch } from "./discover-page";

const video = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	platform: "tiktok",
	externalId: id,
	url: `https://www.tiktok.com/@criador_teste/video/${id}`,
	caption: `Como criar vídeos com IA ${id}`,
	creatorHandle: "criador_teste",
	creatorName: null,
	thumbnailUrl: null,
	publishedAt: "2026-11-10T12:00:00.000Z",
	durationSeconds: null,
	language: "pt",
	metrics: { views: 12_500, likes: 800, comments: null, shares: null },
	source: "teste",
	firstCollectedAt: "2026-11-13T12:00:00.000Z",
	lastCollectedAt: "2026-11-13T12:00:00.000Z",
	metricsObservedAt: "2026-11-13T12:00:00.000Z",
	matchScore: 1,
	popularity: 1,
	growing: false,
	score: 1,
	...overrides,
});

const view = (overrides: Record<string, unknown> = {}) => ({
	requestId: "req-1",
	query: "como criar vídeos com AI",
	platforms: ["instagram", "tiktok"],
	period: "30d",
	sort: "relevance",
	status: "ready",
	message: null,
	progress: null,
	updatedAt: "2026-11-13T12:00:00.000Z",
	stale: false,
	platformStatus: [
		{ platform: "instagram", status: "ok", message: null },
		{ platform: "tiktok", status: "ok", message: null },
	],
	label: "Populares sobre este assunto",
	results: [video("v1")],
	total: 1,
	...overrides,
});

function Harness({ initial = {} }: { initial?: DiscoverSearch }) {
	const [search, setSearch] = useState<DiscoverSearch>(initial);
	return (
		<DiscoverPage companyId="c1" search={search} onSearchChange={setSearch} />
	);
}

function renderPage(initial?: DiscoverSearch) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<Harness {...(initial ? { initial } : {})} />
		</QueryClientProvider>,
	);
}

describe("Descobrir vídeos (RN-110 a RN-119)", () => {
	let calls: { method: string; url: string; body: unknown }[];
	let postReply: unknown;
	let getReplies: unknown[];

	beforeEach(() => {
		calls = [];
		postReply = view();
		getReplies = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				if (call.method === "POST") return Response.json(postReply);
				return Response.json(getReplies.shift() ?? view());
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("começa vazio com exemplos e só pesquisa no Enter, não a cada tecla", async () => {
		renderPage();
		expect(
			screen.getByText("Pesquise um assunto para ver vídeos populares"),
		).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "como criar vídeos com IA" }),
		);
		expect(calls).toHaveLength(0);

		await userEvent.type(screen.getByLabelText("Assunto"), "{Enter}");
		expect(calls.filter((c) => c.method === "POST")).toEqual([
			{
				method: "POST",
				url: "/api/app/companies/c1/videos/searches",
				body: {
					query: "como criar vídeos com IA",
					platform: "all",
					period: "30d",
					sort: "relevance",
				},
			},
		]);
		expect(
			await screen.findByText("Populares sobre este assunto"),
		).toBeInTheDocument();
	});

	it("mostra o card com o que existe e o link original em outra aba", async () => {
		renderPage();
		await userEvent.type(
			screen.getByLabelText("Assunto"),
			"como criar vídeos com AI{Enter}",
		);

		const card = (
			await screen.findByText("Como criar vídeos com IA v1")
		).closest("article");
		if (!card) throw new Error("card");
		const metrics = within(card).getByRole("list", {
			name: "Métricas públicas",
		});
		expect(metrics).toHaveTextContent("12,5 mil");
		expect(metrics).toHaveTextContent("800");
		// Comentários e compartilhamentos não vieram: não aparecem como zero.
		expect(within(card).queryByText("comentários")).toBeNull();
		const link = within(card).getByRole("link", { name: "Assistir no TikTok" });
		expect(link).toHaveAttribute(
			"href",
			"https://www.tiktok.com/@criador_teste/video/v1",
		);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
		expect(within(card).getByText(/@criador_teste/)).toBeInTheDocument();
	});

	it("RN-119: falha no Instagram aparece sem esconder o TikTok", async () => {
		postReply = view({
			platformStatus: [
				{
					platform: "instagram",
					status: "failed",
					message:
						"Não foi possível buscar no Instagram agora. Mostrando o que foi encontrado nas outras plataformas.",
				},
				{ platform: "tiktok", status: "ok", message: null },
			],
		});
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Não foi possível buscar no Instagram",
		);
		expect(screen.getByText("Como criar vídeos com IA v1")).toBeInTheDocument();
	});

	it("coletando: mostra o progresso e depois os resultados", async () => {
		postReply = view({
			status: "collecting",
			updatedAt: null,
			results: [],
			total: 0,
			progress: { done: 1, total: 4 },
		});
		getReplies = [
			view({
				status: "collecting",
				updatedAt: null,
				results: [],
				total: 0,
				progress: { done: 1, total: 4 },
			}),
			view(),
		];
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");
		expect(
			await screen.findByText("Coletando vídeos sobre este assunto..."),
		).toBeInTheDocument();
		expect(screen.getByLabelText("1 de 4 etapas")).toBeInTheDocument();
		expect(
			await screen.findByText(
				"Como criar vídeos com IA v1",
				{},
				{ timeout: 5_000 },
			),
		).toBeInTheDocument();
	}, 10_000);

	it("avisa quando os resultados vêm de uma atualização anterior", async () => {
		postReply = view({ status: "refreshing" });
		getReplies = [view({ status: "refreshing" })];
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");
		expect(
			await screen.findByText(/Atualizando em segundo plano/),
		).toBeInTheDocument();
	});

	it("sem integração configurada, avisa e não mostra vídeos", async () => {
		postReply = view({
			requestId: null,
			status: "not_configured",
			message: "A busca de vídeos ainda não foi configurada neste ambiente.",
			updatedAt: null,
			results: [],
			total: 0,
		});
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"ainda não foi configurada",
		);
		expect(screen.queryByRole("article")).toBeNull();
	});

	it("nenhum resultado sugere o próximo passo", async () => {
		postReply = view({ results: [], total: 0 });
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");
		expect(
			await screen.findByText("Nenhum vídeo encontrado"),
		).toBeInTheDocument();
	});

	it("mostra o erro de negócio do servidor, como o limite diário", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{
						error: "quota_exhausted",
						message:
							"Você chegou ao limite de 20 pesquisas de vídeos por dia. Tente amanhã.",
					},
					{ status: 429 },
				),
			),
		);
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Você chegou ao limite de 20 pesquisas de vídeos por dia. Tente amanhã.",
		);
	});

	it("RN-119: mostra os vídeos sugeridos, sem carregar mais", async () => {
		postReply = view({
			results: [
				video("v1"),
				video("v2"),
				video("v3"),
				video("v4"),
				video("v5"),
			],
			total: 12,
		});
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");

		expect(
			await screen.findByText("Como criar vídeos com IA v5"),
		).toBeInTheDocument();
		expect(screen.getAllByText(/Como criar vídeos com IA v\d/)).toHaveLength(5);
		expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
	});

	it("trocar a plataforma refaz a pesquisa uma vez; trocar a ordem não coleta", async () => {
		renderPage();
		await userEvent.type(screen.getByLabelText("Assunto"), "receitas{Enter}");
		await screen.findByText("Populares sobre este assunto");
		await userEvent.click(screen.getByRole("button", { name: "TikTok" }));
		const posts = calls.filter((c) => c.method === "POST");
		expect(posts).toHaveLength(2);
		expect(posts[1]?.body).toMatchObject({ platform: "tiktok" });

		await userEvent.selectOptions(
			screen.getByLabelText("Ordenar por"),
			"popularity",
		);
		expect(calls.filter((c) => c.method === "POST")).toHaveLength(2);
	});
});
