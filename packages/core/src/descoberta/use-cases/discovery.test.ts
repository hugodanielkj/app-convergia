import { beforeEach, describe, expect, it } from "vitest";
import {
	client,
	otherCompanyClient,
	readOnly,
} from "../../conteudo/testing/actors";
import { InMemoryQuotaRepository } from "../../cotas/testing/in-memory-quota-repository";
import { quotaDay, userQuotaKey } from "../../policies/quota.policy";
import { VideoProviderError } from "../ports/video-provider";
import { DEFAULT_DISCOVERY_SETTINGS } from "../settings";
import {
	FakeDiscoveryQueue,
	FakeQueryExpander,
	FakeVideoProvider,
	testVideo,
} from "../testing/fakes";
import { InMemoryDiscoveryRepository } from "../testing/in-memory-discovery-repository";
import type { VideoSearchInput } from "../video";
import type { DiscoveryDeps } from "./deps";
import { discoverVideos, getVideoSearch } from "./discover-videos";
import { runVideoQuery } from "./run-video-query";

const QUERY = "como criar vídeos com AI";
const input = (
	overrides: Partial<VideoSearchInput> = {},
): VideoSearchInput => ({
	query: QUERY,
	platform: "all",
	period: "30d",
	sort: "relevance",
	...overrides,
});

describe("descoberta de vídeos (RN-110 a RN-119)", () => {
	let clock: Date;
	let deps: DiscoveryDeps & {
		discovery: InMemoryDiscoveryRepository;
		videoProvider: FakeVideoProvider;
		discoveryQueue: FakeDiscoveryQueue;
		queryExpander: FakeQueryExpander;
		quotas: InMemoryQuotaRepository;
	};
	const recent = () => new Date(clock.getTime() - 2 * 86_400_000);
	const advance = (ms: number) => {
		clock = new Date(clock.getTime() + ms);
	};
	const runQueued = async () => {
		for (const id of deps.discoveryQueue.enqueued.splice(0)) {
			await runVideoQuery(deps, id);
		}
	};
	const used = (actor = client) =>
		deps.quotas.used.get(
			InMemoryQuotaRepository.key(
				actor.companyId,
				userQuotaKey("discover_videos", actor.userId),
				quotaDay(clock),
			),
		) ?? 0;

	beforeEach(() => {
		clock = new Date("2026-11-13T12:00:00Z");
		const now = () => clock;
		deps = {
			discovery: new InMemoryDiscoveryRepository(now),
			videoProvider: new FakeVideoProvider(),
			discoveryQueue: new FakeDiscoveryQueue(),
			queryExpander: new FakeQueryExpander(),
			quotas: new InMemoryQuotaRepository(),
			discoverySettings: { ...DEFAULT_DISCOVERY_SETTINGS, maxPagesPerTerm: 1 },
			now,
		};
		deps.videoProvider.pages = {
			tiktok: [
				{
					videos: [
						testVideo({
							platform: "tiktok",
							externalId: "tt1",
							caption: "Como criar vídeos com IA #ai",
							publishedAt: recent(),
							language: "pt",
							metrics: {
								views: 50_000,
								likes: 3_000,
								comments: 40,
								shares: 10,
							},
						}),
						testVideo({
							platform: "tiktok",
							externalId: "tt-off",
							caption: "Receita de bolo de cenoura",
							publishedAt: recent(),
						}),
					],
					nextCursor: "20",
				},
			],
			instagram: [
				{
					videos: [
						testVideo({
							platform: "instagram",
							externalId: "ig1",
							caption:
								"Vídeos com inteligência artificial: criar em 3 passos #ia",
							publishedAt: recent(),
							metrics: { likes: 900, comments: 12 },
						}),
					],
					nextCursor: null,
				},
			],
		};
	});

	describe("pesquisar", () => {
		it("pesquisa nova entra na fila, mostra o progresso e depois os resultados", async () => {
			const first = await discoverVideos(deps, client, input());
			expect(first).toMatchObject({
				status: "collecting",
				results: [],
				label: "Populares sobre este assunto",
			});
			expect(deps.discoveryQueue.enqueued).toHaveLength(1);

			await runQueued();
			const view = await getVideoSearch(deps, client, first.requestId ?? "", {
				sort: "relevance",
				offset: 0,
			});
			expect(view.status).toBe("ready");
			expect(view.results.map((v) => v.externalId).sort()).toEqual([
				"ig1",
				"tt1",
			]);
			expect(view.stale).toBe(false);
		});

		it("RN-114: a mesma pesquisa dentro da validade volta do cache, sem coletar", async () => {
			await discoverVideos(deps, client, input());
			await runQueued();
			const calls = deps.videoProvider.calls.length;

			const again = await discoverVideos(
				deps,
				client,
				input({ query: "  Como criar VIDEOS com ai " }),
			);
			expect(again.status).toBe("ready");
			expect(again.results).toHaveLength(2);
			expect(deps.videoProvider.calls).toHaveLength(calls);
			expect(deps.discoveryQueue.enqueued).toHaveLength(0);
			expect(deps.discovery.requests.at(-1)?.cacheStatus).toBe("hit");
			expect(used()).toBe(1);
		});

		it("RN-114: depois da validade, mostra a atualização anterior e atualiza em segundo plano", async () => {
			await discoverVideos(deps, client, input());
			await runQueued();
			advance(7 * 3_600_000);

			const stale = await discoverVideos(deps, client, input());
			expect(stale).toMatchObject({ status: "refreshing", stale: true });
			expect(stale.results).toHaveLength(2);
			expect(deps.discoveryQueue.enqueued).toHaveLength(1);
			expect(deps.discovery.requests.at(-1)?.cacheStatus).toBe("stale");
		});

		it("RN-114: pesquisas iguais em andamento reaproveitam a mesma coleta", async () => {
			await discoverVideos(deps, client, input());
			const second = await discoverVideos(deps, otherCompanyClient, input());
			expect(second.status).toBe("collecting");
			expect(deps.discoveryQueue.enqueued).toHaveLength(1);
			expect(deps.discovery.requests.at(-1)?.cacheStatus).toBe("joined");
			expect(used(otherCompanyClient)).toBe(0);
		});

		it("filtros diferentes são pesquisas diferentes", async () => {
			await discoverVideos(deps, client, input());
			await discoverVideos(deps, client, input({ platform: "tiktok" }));
			expect(deps.discoveryQueue.enqueued).toHaveLength(2);
		});

		it("sem chave do provedor, avisa que a integração precisa ser configurada", async () => {
			deps.videoProvider.configured = false;
			const view = await discoverVideos(deps, client, input());
			expect(view).toMatchObject({
				status: "not_configured",
				results: [],
				requestId: null,
			});
			expect(view.message).toContain("não foi configurada");
			expect(deps.discoveryQueue.enqueued).toHaveLength(0);
			expect(used()).toBe(0);
		});

		it("RN-024: conexão só de leitura não pesquisa", async () => {
			await expect(discoverVideos(deps, readOnly, input())).rejects.toThrow(
				"Esta conexão é só de leitura",
			);
		});

		it("RN-015: a pesquisa de uma empresa não aparece para outra", async () => {
			const view = await discoverVideos(deps, client, input());
			await expect(
				getVideoSearch(deps, otherCompanyClient, view.requestId ?? "", {
					sort: "relevance",
					offset: 0,
				}),
			).rejects.toThrow("Pesquisa não encontrada.");
		});
	});

	describe("limites e falhas (RN-118, RN-305)", () => {
		it("RN-118: limite diário por usuário só conta pesquisas que coletam", async () => {
			deps.discoverySettings = {
				...deps.discoverySettings,
				dailySearchesPerUser: 1,
			};
			await discoverVideos(deps, client, input());
			await expect(
				discoverVideos(deps, client, input({ query: "outra coisa" })),
			).rejects.toThrow(
				"Você chegou ao limite de 1 pesquisas de vídeos por dia. Tente amanhã.",
			);
			// A mesma pesquisa em andamento não gasta cota.
			await expect(
				discoverVideos(deps, client, input()),
			).resolves.toMatchObject({
				status: "collecting",
			});
		});

		it("RN-118: limite por minuto por usuário", async () => {
			deps.discoverySettings = {
				...deps.discoverySettings,
				searchesPerMinutePerUser: 2,
			};
			await discoverVideos(deps, client, input({ query: "assunto um" }));
			await discoverVideos(deps, client, input({ query: "assunto dois" }));
			await expect(
				discoverVideos(deps, client, input({ query: "assunto três" })),
			).rejects.toThrow("Muitas pesquisas em pouco tempo");
			advance(61_000);
			await expect(
				discoverVideos(deps, client, input({ query: "assunto três" })),
			).resolves.toBeDefined();
		});

		it("RN-305: se todas as plataformas falham, a cota volta e a tela mostra o erro", async () => {
			deps.videoProvider.failures = {
				tiktok: new VideoProviderError("unavailable", "fora do ar"),
				instagram: new VideoProviderError("blocked", "bloqueado"),
			};
			const view = await discoverVideos(deps, client, input());
			expect(used()).toBe(1);
			await runQueued();
			expect(used()).toBe(0);
			const after = await getVideoSearch(deps, client, view.requestId ?? "", {
				sort: "relevance",
				offset: 0,
			});
			expect(after.status).toBe("failed");
			expect(after.message).toContain("Não foi possível buscar vídeos agora");
		});

		it("RN-119: falha no Instagram não esconde os resultados do TikTok", async () => {
			deps.videoProvider.failures = {
				instagram: new VideoProviderError("blocked", "bloqueado"),
			};
			const view = await discoverVideos(deps, client, input());
			await runQueued();
			const after = await getVideoSearch(deps, client, view.requestId ?? "", {
				sort: "relevance",
				offset: 0,
			});
			expect(after.status).toBe("ready");
			expect(after.results.map((v) => v.externalId)).toEqual(["tt1"]);
			expect(after.platformStatus).toEqual([
				{
					platform: "instagram",
					status: "failed",
					message: expect.stringContaining(
						"Não foi possível buscar no Instagram",
					),
				},
				{ platform: "tiktok", status: "ok", message: null },
			]);
			expect(used()).toBe(1);
		});

		it("RN-305: se a fila recusar, a cota volta e o erro sobe", async () => {
			deps.discoveryQueue.failWith = new Error("fila fora do ar");
			await expect(discoverVideos(deps, client, input())).rejects.toThrow(
				"fila fora do ar",
			);
			expect(used()).toBe(0);
			// A próxima tentativa pode começar de novo.
			deps.discoveryQueue.failWith = null;
			await expect(
				discoverVideos(deps, client, input()),
			).resolves.toMatchObject({
				status: "collecting",
			});
		});

		it("coleta parada há muito tempo pode recomeçar", async () => {
			await discoverVideos(deps, client, input());
			deps.discoveryQueue.enqueued.splice(0);
			advance(11 * 60_000);
			await discoverVideos(deps, client, input());
			expect(deps.discoveryQueue.enqueued).toHaveLength(1);
		});
	});

	describe("coleta (runVideoQuery)", () => {
		it("RN-112: tira repetidos por plataforma + ID e mantém vazio o que não veio", async () => {
			const duplicate = testVideo({
				platform: "tiktok",
				externalId: "tt1",
				caption: "Como criar vídeos com IA #ai",
				publishedAt: recent(),
			});
			deps.videoProvider.pages.tiktok?.[0]?.videos.push(duplicate);
			await discoverVideos(deps, client, input({ platform: "tiktok" }));
			await runQueued();

			expect(
				deps.discovery.videos.filter((v) => v.externalId === "tt1"),
			).toHaveLength(1);
			const ig = deps.discovery.videos.find((v) => v.externalId === "ig1");
			expect(ig).toBeUndefined();
			const tt = deps.discovery.videos.find((v) => v.externalId === "tt1");
			// A segunda aparição sem métricas não apaga as que já tinha.
			expect(tt?.metrics).toEqual({
				views: 50_000,
				likes: 3_000,
				comments: 40,
				shares: 10,
			});
		});

		it("RN-115: só guarda vídeos cuja legenda fala do assunto e do período pedido", async () => {
			deps.videoProvider.pages.tiktok?.[0]?.videos.push(
				testVideo({
					platform: "tiktok",
					externalId: "tt-old",
					caption: "Criar vídeos com IA",
					publishedAt: new Date(clock.getTime() - 40 * 86_400_000),
				}),
				testVideo({
					platform: "tiktok",
					externalId: "tt-nodate",
					caption: "Criar vídeos com IA",
				}),
			);
			await discoverVideos(deps, client, input({ platform: "tiktok" }));
			await runQueued();
			expect(deps.discovery.videos.map((v) => v.externalId)).toEqual(["tt1"]);
		});

		it("RN-111: usa até 3 termos, ignora variações repetidas e respeita o limite de chamadas", async () => {
			deps.queryExpander.suggestions = [
				"Como criar vídeos com AI",
				"#videocomia",
				"criar vídeos com inteligência artificial",
				"quarta variação",
			];
			deps.discoverySettings = {
				...deps.discoverySettings,
				maxCallsPerSearch: 4,
			};
			await discoverVideos(deps, client, input());
			await runQueued();

			const terms = deps.discovery.queries[0]?.terms;
			expect(terms).toEqual([
				QUERY,
				"#videocomia",
				"criar vídeos com inteligência artificial",
			]);
			expect(deps.queryExpander.calls[0]).toMatchObject({
				companyId: client.companyId,
				max: 2,
			});
			expect(deps.videoProvider.calls).toHaveLength(4);
			expect(deps.videoProvider.calls[0]).toMatchObject({
				platform: "instagram",
				language: "pt",
			});
		});

		it("RN-111: se a IA falhar, segue só com a frase original", async () => {
			deps.queryExpander.failWith = new Error("IA fora do ar");
			await discoverVideos(deps, client, input());
			await runQueued();
			expect(deps.discovery.queries[0]?.terms).toEqual([QUERY]);
			expect(deps.discovery.queries[0]?.status).toBe("ready");
		});

		it("busca as visualizações do Reels que não as trouxe, dentro do orçamento", async () => {
			deps.videoProvider.metrics.set("ig1", {
				views: 12_000,
				likes: 950,
				comments: 13,
				shares: null,
			});
			await discoverVideos(deps, client, input());
			await runQueued();
			expect(deps.videoProvider.metricCalls).toEqual([
				{ platform: "instagram", externalId: "ig1" },
			]);
			const ig = deps.discovery.videos.find((v) => v.externalId === "ig1");
			expect(ig?.metrics).toEqual({
				views: 12_000,
				likes: 950,
				comments: 13,
				shares: null,
			});
			expect(
				deps.discovery.observations.filter((o) => o.videoId === ig?.id),
			).toHaveLength(2);
		});

		it("RN-117: só marca Em crescimento com duas leituras espaçadas mostrando alta", async () => {
			const view = await discoverVideos(
				deps,
				client,
				input({ platform: "tiktok" }),
			);
			await runQueued();
			let page = await getVideoSearch(deps, client, view.requestId ?? "", {
				sort: "relevance",
				offset: 0,
			});
			expect(page.results[0]?.growing).toBe(false);

			advance(7 * 3_600_000);
			const page1 = deps.videoProvider.pages.tiktok?.[0];
			if (!page1?.videos[0]) throw new Error("fixture");
			page1.videos[0] = {
				...page1.videos[0],
				metrics: { ...page1.videos[0].metrics, views: 80_000 },
			};
			deps.videoProvider.calls.splice(0);
			await discoverVideos(deps, client, input({ platform: "tiktok" }));
			await runQueued();
			page = await getVideoSearch(deps, client, view.requestId ?? "", {
				sort: "relevance",
				offset: 0,
			});
			expect(page.results[0]?.growing).toBe(true);
		});

		it("RN-119: pagina os resultados em blocos", async () => {
			deps.discoverySettings = { ...deps.discoverySettings, pageSize: 1 };
			const view = await discoverVideos(deps, client, input());
			await runQueued();
			const first = await getVideoSearch(deps, client, view.requestId ?? "", {
				sort: "relevance",
				offset: 0,
			});
			expect(first).toMatchObject({ total: 2, nextOffset: 1 });
			const second = await getVideoSearch(deps, client, view.requestId ?? "", {
				sort: "relevance",
				offset: 1,
			});
			expect(second).toMatchObject({ nextOffset: null });
			expect(second.results[0]?.id).not.toBe(first.results[0]?.id);
		});
	});
});
