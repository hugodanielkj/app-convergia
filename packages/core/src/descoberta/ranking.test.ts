import { describe, expect, it } from "vitest";
import {
	isGrowing,
	popularityByPlatform,
	type QueryResult,
	rankVideos,
} from "./ranking";
import { DEFAULT_DISCOVERY_SETTINGS } from "./settings";
import type {
	CatalogVideo,
	MetricObservation,
	VideoMetrics,
	VideoPlatform,
} from "./video";

const now = new Date("2026-11-13T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const noMetrics: VideoMetrics = {
	views: null,
	likes: null,
	comments: null,
	shares: null,
};

function video(
	id: string,
	platform: VideoPlatform,
	metrics: Partial<VideoMetrics> = {},
	publishedAt: Date | null = daysAgo(3),
): CatalogVideo {
	return {
		id,
		platform,
		externalId: id,
		url: `https://example.com/${id}`,
		caption: null,
		creatorHandle: null,
		creatorName: null,
		thumbnailUrl: null,
		publishedAt,
		durationSeconds: null,
		language: null,
		metrics: { ...noMetrics, ...metrics },
		source: "teste",
		firstCollectedAt: now,
		lastCollectedAt: now,
		metricsObservedAt: now,
	};
}

const result = (
	v: CatalogVideo,
	matchScore = 1,
	providerRank = 0,
): QueryResult => ({
	video: v,
	matchScore,
	providerRank,
});

const options = (
	sort: "relevance" | "popularity" | "recent" = "relevance",
) => ({
	sort,
	now,
	language: null,
	observations: new Map<string, MetricObservation[]>(),
	settings: DEFAULT_DISCOVERY_SETTINGS,
});

describe("popularidade e ordenação (RN-115, RN-116)", () => {
	it("RN-116: calcula a popularidade dentro de cada plataforma", () => {
		const pop = popularityByPlatform([
			video("tt-big", "tiktok", { views: 5_000_000 }),
			video("tt-small", "tiktok", { views: 10_000 }),
			video("ig-big", "instagram", { likes: 9_000 }),
			video("ig-small", "instagram", { likes: 20 }),
		]);
		// O maior do Instagram empata com o maior do TikTok, mesmo com números muito menores.
		expect(pop.get("tt-big")).toBe(1);
		expect(pop.get("ig-big")).toBe(1);
		expect(pop.get("tt-small")).toBe(0);
		expect(pop.get("ig-small")).toBe(0);
	});

	it("RN-112: vídeo sem nenhuma métrica fica sem popularidade, não com zero", () => {
		const pop = popularityByPlatform([
			video("a", "tiktok", { views: 100 }),
			video("b", "tiktok"),
		]);
		expect(pop.get("b")).toBeNull();
	});

	it("ordena por popularidade, por data ou pela combinação", () => {
		const old = video("old", "tiktok", { views: 9_000_000 }, daysAgo(60));
		const fresh = video("fresh", "tiktok", { views: 1_000 }, daysAgo(1));
		const undated = video("undated", "tiktok", {}, null);
		const results = [
			result(undated, 1, 0),
			result(old, 1, 1),
			result(fresh, 1, 2),
		];

		expect(rankVideos(results, options("popularity")).map((v) => v.id)).toEqual(
			["old", "fresh", "undated"],
		);
		expect(rankVideos(results, options("recent")).map((v) => v.id)).toEqual([
			"fresh",
			"old",
			"undated",
		]);
		const relevance = rankVideos(
			[result(old, 0.4), result(fresh, 1)],
			options("relevance"),
		);
		expect(relevance[0]?.id).toBe("fresh");
	});

	it("RN-113: o idioma da pesquisa só dá um pequeno bônus no empate", () => {
		const pt = { ...video("pt", "tiktok"), language: "pt" };
		const en = { ...video("en", "tiktok"), language: "en" };
		const ranked = rankVideos([result(en, 1, 0), result(pt, 1, 1)], {
			...options(),
			language: "pt",
		});
		expect(ranked.map((v) => v.id)).toEqual(["pt", "en"]);
	});
});

describe("Em crescimento (RN-117)", () => {
	const growth = DEFAULT_DISCOVERY_SETTINGS.growth;
	const observation = (
		hoursAgo: number,
		views: number | null,
		likes: number | null = null,
	) => ({
		videoId: "v",
		observedAt: new Date(now.getTime() - hoursAgo * 3_600_000),
		views,
		likes,
		comments: null,
		shares: null,
	});

	it("exige duas leituras em momentos diferentes com alta real", () => {
		expect(isGrowing([observation(1, 1_000)], growth)).toBe(false);
		expect(
			isGrowing([observation(24, 1_000), observation(1, 1_500)], growth),
		).toBe(true);
		// Leituras próximas demais não comprovam crescimento.
		expect(
			isGrowing([observation(2, 1_000), observation(1, 5_000)], growth),
		).toBe(false);
		// Alta pequena não basta.
		expect(
			isGrowing([observation(24, 1_000), observation(1, 1_020)], growth),
		).toBe(false);
	});

	it("usa curtidas quando não há visualizações nas duas leituras", () => {
		expect(
			isGrowing(
				[observation(30, null, 100), observation(2, null, 200)],
				growth,
			),
		).toBe(true);
		expect(
			isGrowing([observation(30, 100), observation(2, null)], growth),
		).toBe(false);
	});
});
