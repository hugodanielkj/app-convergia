import {
	type CollectedVideo,
	type ProviderErrorKind,
	type ProviderSearchPage,
	type SearchPeriod,
	type VideoMetrics,
	type VideoPlatform,
	type VideoProvider,
	VideoProviderError,
} from "@convergia/core";
import { z } from "zod";

export const SCRAPECREATORS_BASE_URL = "https://api.scrapecreators.com";

/** A busca de Reels aceita as páginas 1 a 11; a 12 devolve 400 (docs.scrapecreators.com). */
const MAX_INSTAGRAM_PAGE = 11;

export type ProviderCall = {
	provider: string;
	platform: VideoPlatform;
	operation: "search" | "metrics";
	durationMs: number;
	attempts: number;
	success: boolean;
	errorKind: ProviderErrorKind | null;
	credits: number | null;
};

export type ScrapeCreatorsOptions = {
	apiKey: string | undefined;
	timeoutMs?: number;
	/** Novas tentativas para falhas passageiras (rede, 429, 5xx). */
	retries?: number;
	/** Registro de cada chamada, para medir latência, erros e consumo (✅ RN-118). */
	onCall?: (call: ProviderCall) => void;
	fetch?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
};

const count = z
	.number()
	.nullish()
	.transform((value) => value ?? null);
const id = z.union([z.string(), z.number()]).transform(String);

const tiktokItem = z.looseObject({
	aweme_id: id,
	desc: z.string().nullish(),
	desc_language: z.string().nullish(),
	create_time: z.number().nullish(),
	url: z.string().nullish(),
	share_url: z.string().nullish(),
	author: z
		.looseObject({
			unique_id: z.string().nullish(),
			nickname: z.string().nullish(),
		})
		.nullish(),
	statistics: z
		.looseObject({
			play_count: count,
			digg_count: count,
			comment_count: count,
			share_count: count,
		})
		.nullish(),
	video: z
		.looseObject({
			duration: z.number().nullish(),
			cover: z
				.looseObject({ url_list: z.array(z.string()).nullish() })
				.nullish(),
		})
		.nullish(),
});

const tiktokSearch = z.looseObject({
	search_item_list: z.array(z.unknown()).nullish(),
	cursor: z.union([z.number(), z.string()]).nullish(),
	has_more: z.union([z.boolean(), z.number()]).nullish(),
	credits_charged: z.number().nullish(),
});

const instagramReel = z.looseObject({
	shortcode: z.string(),
	url: z.string().nullish(),
	caption: z.string().nullish(),
	thumbnail_src: z.string().nullish(),
	display_url: z.string().nullish(),
	video_duration: z.number().nullish(),
	taken_at: z.union([z.string(), z.number()]).nullish(),
	owner: z
		.looseObject({
			username: z.string().nullish(),
			full_name: z.string().nullish(),
		})
		.nullish(),
	video_view_count: count,
	video_play_count: count,
	like_count: count,
	comment_count: count,
});

const instagramSearch = z.looseObject({
	reels: z.array(z.unknown()).nullish(),
	credits_charged: z.number().nullish(),
});

const instagramPost = z.looseObject({
	data: z
		.looseObject({
			xdt_shortcode_media: z
				.looseObject({
					video_play_count: count,
					video_view_count: count,
					edge_media_preview_like: z.looseObject({ count: count }).nullish(),
					edge_media_to_parent_comment: z
						.looseObject({ count: count })
						.nullish(),
					edge_media_to_comment: z.looseObject({ count: count }).nullish(),
				})
				.nullish(),
		})
		.nullish(),
	credits_charged: z.number().nullish(),
});

const tiktokVideo = z.looseObject({
	aweme_detail: tiktokItem.nullish(),
	credits_charged: z.number().nullish(),
});

const TIKTOK_PERIOD: Record<SearchPeriod, string> = {
	"7d": "this-week",
	"30d": "this-month",
	any: "all-time",
};
const INSTAGRAM_PERIOD: Record<SearchPeriod, string | null> = {
	"7d": "last-week",
	"30d": "last-month",
	any: null,
};

function errorKindFor(status: number): ProviderErrorKind {
	if (status === 400) return "invalid_request";
	if (status === 401) return "unauthorized";
	if (status === 402) return "out_of_credits";
	if (status === 403) return "blocked";
	if (status === 404) return "not_found";
	if (status === 429) return "rate_limited";
	return "unavailable";
}

const retryable = (kind: ProviderErrorKind) =>
	kind === "rate_limited" || kind === "unavailable";

function date(value: string | number | null | undefined): Date | null {
	if (value === null || value === undefined) return null;
	const parsed =
		typeof value === "number" ? new Date(value * 1000) : new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function webUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.toString()
			: null;
	} catch {
		return null;
	}
}

function fromTiktok(item: z.infer<typeof tiktokItem>): CollectedVideo {
	const handle = item.author?.unique_id ?? null;
	const url =
		webUrl(item.url) ??
		(handle
			? `https://www.tiktok.com/@${handle}/video/${item.aweme_id}`
			: `https://www.tiktok.com/video/${item.aweme_id}`);
	const durationMs = item.video?.duration ?? null;
	return {
		platform: "tiktok",
		externalId: item.aweme_id,
		url,
		caption: item.desc?.trim() || null,
		creatorHandle: handle,
		creatorName: item.author?.nickname ?? null,
		thumbnailUrl: webUrl(item.video?.cover?.url_list?.[0]),
		publishedAt: date(item.create_time),
		// O TikTok informa a duração em milissegundos.
		durationSeconds: durationMs === null ? null : durationMs / 1000,
		language: item.desc_language ?? null,
		metrics: {
			views: item.statistics?.play_count ?? null,
			likes: item.statistics?.digg_count ?? null,
			comments: item.statistics?.comment_count ?? null,
			shares: item.statistics?.share_count ?? null,
		},
	};
}

function fromInstagram(reel: z.infer<typeof instagramReel>): CollectedVideo {
	return {
		platform: "instagram",
		externalId: reel.shortcode,
		url:
			webUrl(reel.url) ?? `https://www.instagram.com/reel/${reel.shortcode}/`,
		caption: reel.caption?.trim() || null,
		creatorHandle: reel.owner?.username ?? null,
		creatorName: reel.owner?.full_name || null,
		thumbnailUrl: webUrl(reel.thumbnail_src) ?? webUrl(reel.display_url),
		publishedAt: date(reel.taken_at),
		durationSeconds: reel.video_duration ?? null,
		language: null,
		metrics: {
			// A busca de Reels não traz visualizações; quando vier, usa.
			views: reel.video_play_count ?? reel.video_view_count ?? null,
			likes: reel.like_count,
			comments: reel.comment_count,
			shares: null,
		},
	};
}

/**
 * Provedor ScrapeCreators (✅ RN-111). TikTok: busca por palavra-chave do próprio TikTok.
 * Instagram: busca de Reels em resultados indexados pelo Google, que é parcial: não é a busca
 * do Instagram e não traz visualizações (por isso `fetchMetrics`).
 */
export function createScrapeCreatorsProvider(
	options: ScrapeCreatorsOptions,
): VideoProvider {
	const http = options.fetch ?? fetch;
	const timeoutMs = options.timeoutMs ?? 20_000;
	const retries = options.retries ?? 2;
	const sleep =
		options.sleep ??
		((ms: number) => new Promise((done) => setTimeout(done, ms)));

	async function call<T>(
		platform: VideoPlatform,
		operation: ProviderCall["operation"],
		path: string,
		params: Record<string, string | undefined>,
		schema: z.ZodType<T>,
	): Promise<T> {
		if (!options.apiKey) {
			throw new VideoProviderError(
				"not_configured",
				"SCRAPECREATORS_API_KEY ausente.",
			);
		}
		const url = new URL(path, SCRAPECREATORS_BASE_URL);
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) url.searchParams.set(key, value);
		}
		const started = performance.now();
		let attempts = 0;
		let credits: number | null = null;
		const log = (success: boolean, errorKind: ProviderErrorKind | null) =>
			options.onCall?.({
				provider: "scrapecreators",
				platform,
				operation,
				durationMs: Math.round(performance.now() - started),
				attempts,
				success,
				errorKind,
				credits,
			});

		for (;;) {
			attempts++;
			let kind: ProviderErrorKind;
			let waitMs = 500 * 2 ** (attempts - 1);
			try {
				const response = await http(url, {
					headers: { "x-api-key": options.apiKey, accept: "application/json" },
					signal: AbortSignal.timeout(timeoutMs),
				});
				if (response.ok) {
					const body: unknown = await response.json();
					const parsed = schema.safeParse(body);
					if (!parsed.success) {
						log(false, "unavailable");
						throw new VideoProviderError(
							"unavailable",
							`Resposta inesperada do provedor em ${path}.`,
						);
					}
					const charged = (body as { credits_charged?: unknown })
						.credits_charged;
					credits = typeof charged === "number" ? charged : null;
					log(true, null);
					return parsed.data;
				}
				kind = errorKindFor(response.status);
				const retryAfter = Number(response.headers.get("retry-after"));
				if (retryAfter > 0) waitMs = Math.min(retryAfter * 1000, 10_000);
				await response.body?.cancel();
			} catch (error) {
				if (error instanceof VideoProviderError) throw error;
				// Rede ou tempo esgotado.
				kind = "unavailable";
			}
			if (!retryable(kind) || attempts > retries) {
				log(false, kind);
				throw new VideoProviderError(kind, `ScrapeCreators ${path}: ${kind}`);
			}
			await sleep(waitMs);
		}
	}

	return {
		name: "scrapecreators",
		configured: Boolean(options.apiKey),

		async search(request): Promise<ProviderSearchPage> {
			if (request.platform === "tiktok") {
				const body = await call(
					"tiktok",
					"search",
					"/v1/tiktok/search/keyword",
					{
						query: request.term,
						date_posted: TIKTOK_PERIOD[request.period],
						sort_by: "relevance",
						// Põe o acesso no Brasil, mas não filtra vídeos pelo país (docs do provedor).
						region: request.language === "pt" ? "BR" : undefined,
						cursor: request.cursor ?? undefined,
					},
					tiktokSearch,
				);
				const videos = (body.search_item_list ?? []).flatMap((entry) => {
					// Cada item vem dentro de `aweme_info` ou direto, conforme a resposta.
					const wrapped = (entry as { aweme_info?: unknown } | null)
						?.aweme_info;
					const item = tiktokItem.safeParse(wrapped ?? entry);
					return item.success ? [fromTiktok(item.data)] : [];
				});
				const next = body.cursor;
				const hasMore =
					body.has_more === undefined || body.has_more === null
						? true
						: Boolean(body.has_more);
				return {
					videos,
					nextCursor:
						videos.length > 0 && hasMore && next !== null && next !== undefined
							? String(next)
							: null,
				};
			}
			const page = Number(request.cursor ?? "1");
			const body = await call(
				"instagram",
				"search",
				"/v2/instagram/reels/search",
				{
					query: request.term,
					date_posted: INSTAGRAM_PERIOD[request.period] ?? undefined,
					page: String(page),
				},
				instagramSearch,
			);
			const videos = (body.reels ?? []).flatMap((entry) => {
				const reel = instagramReel.safeParse(entry);
				return reel.success ? [fromInstagram(reel.data)] : [];
			});
			return {
				videos,
				nextCursor:
					videos.length > 0 && page < MAX_INSTAGRAM_PAGE
						? String(page + 1)
						: null,
			};
		},

		async fetchMetrics(platform, video): Promise<VideoMetrics> {
			if (platform === "tiktok") {
				const body = await call(
					"tiktok",
					"metrics",
					"/v2/tiktok/video",
					{ url: video.url },
					tiktokVideo,
				);
				const stats = body.aweme_detail?.statistics;
				return {
					views: stats?.play_count ?? null,
					likes: stats?.digg_count ?? null,
					comments: stats?.comment_count ?? null,
					shares: stats?.share_count ?? null,
				};
			}
			const body = await call(
				"instagram",
				"metrics",
				"/v1/instagram/post",
				{ url: video.url },
				instagramPost,
			);
			const media = body.data?.xdt_shortcode_media;
			return {
				views: media?.video_play_count ?? media?.video_view_count ?? null,
				likes: media?.edge_media_preview_like?.count ?? null,
				comments:
					media?.edge_media_to_parent_comment?.count ??
					media?.edge_media_to_comment?.count ??
					null,
				shares: null,
			};
		},
	};
}
