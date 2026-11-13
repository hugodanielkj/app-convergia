import type {
	CollectedVideo,
	SearchPeriod,
	VideoMetrics,
	VideoPlatform,
} from "../video";

export type ProviderSearchRequest = {
	platform: VideoPlatform;
	term: string;
	period: SearchPeriod;
	/** Cursor devolvido pela página anterior; `null` na primeira. */
	cursor: string | null;
	/** Idioma da pesquisa, para o provedor priorizar vídeos nesse idioma quando souber. */
	language: "pt" | null;
};

export type ProviderSearchPage = {
	videos: CollectedVideo[];
	/** `null` quando o provedor não tem mais páginas ou não pagina. */
	nextCursor: string | null;
};

/** Falhas do provedor, já traduzidas para o mesmo vocabulário em qualquer fornecedor. */
export const PROVIDER_ERROR_KINDS = [
	"not_configured",
	"unauthorized",
	"out_of_credits",
	"rate_limited",
	"blocked",
	"not_found",
	"invalid_request",
	"unavailable",
] as const;
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number];

export class VideoProviderError extends Error {
	readonly kind: ProviderErrorKind;

	constructor(kind: ProviderErrorKind, message: string) {
		super(message);
		this.name = "VideoProviderError";
		this.kind = kind;
	}
}

/**
 * Fornecedor de dados públicos de vídeos (✅ RN-111). Trocar de fornecedor muda só a
 * implementação desta porta em `packages/infra`; o app e os casos de uso não mudam.
 */
export interface VideoProvider {
	readonly name: string;
	/** `false` quando falta a chave: a busca avisa que a integração precisa ser configurada. */
	readonly configured: boolean;
	search(request: ProviderSearchRequest): Promise<ProviderSearchPage>;
	/** Métricas atuais de um vídeo já conhecido. */
	fetchMetrics(
		platform: VideoPlatform,
		video: { externalId: string; url: string },
	): Promise<VideoMetrics>;
}
