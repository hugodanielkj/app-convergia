import type { RankedVideo, VideoSearchView } from "@convergia/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const PLATFORM = { instagram: "Instagram", tiktok: "TikTok" } as const;
const number = new Intl.NumberFormat("pt-BR");
const day = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeZone: "America/Sao_Paulo",
});
const moment = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeStyle: "short",
	timeZone: "America/Sao_Paulo",
});

/** Só as métricas que o provedor trouxe; ausente não vira zero (RN-112). */
function metricsText(video: RankedVideo): string {
	const parts = [
		video.metrics.views !== null &&
			`${number.format(video.metrics.views)} visualizações`,
		video.metrics.likes !== null &&
			`${number.format(video.metrics.likes)} curtidas`,
		video.metrics.comments !== null &&
			`${number.format(video.metrics.comments)} comentários`,
		video.metrics.shares !== null &&
			`${number.format(video.metrics.shares)} compartilhamentos`,
	].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : "sem métricas disponíveis";
}

function videoText(video: RankedVideo, index: number): string {
	const caption = video.caption
		? video.caption.replace(/\s+/g, " ").slice(0, 160)
		: "(sem legenda)";
	const creator = video.creatorHandle
		? `@${video.creatorHandle}`
		: "criador não informado";
	const published = video.publishedAt
		? ` · publicado em ${day.format(video.publishedAt)}`
		: "";
	const growing = video.growing ? " · Em crescimento" : "";
	return `${index}. [${PLATFORM[video.platform]}] ${creator}${published}${growing}\n   ${caption}\n   ${metricsText(video)}\n   ${video.url}`;
}

/** Texto para a IA do cliente MCP, com o ID para acompanhar a pesquisa. */
export function videoSearchResult(view: VideoSearchView): CallToolResult {
	const lines: string[] = [];
	if (view.requestId)
		lines.push(`Pesquisa (ID: ${view.requestId}): "${view.query}"`);
	if (view.message) lines.push(view.message);
	if (view.status === "collecting") {
		const progress = view.progress
			? ` (${view.progress.done} de ${view.progress.total} etapas)`
			: "";
		lines.push(
			`Coletando vídeos${progress}. Consulte de novo com get_discovered_videos.`,
		);
	}
	if (view.status === "refreshing") {
		lines.push(
			"Atualizando em segundo plano; abaixo, os resultados da atualização anterior.",
		);
	}
	for (const platform of view.platformStatus) {
		if (platform.message) lines.push(platform.message);
	}
	if (view.updatedAt) {
		lines.push(
			`${view.label} · atualizado em ${moment.format(view.updatedAt)}${view.stale ? " (atualização anterior)" : ""}. Relevância estimada pela legenda; métricas públicas no momento da coleta.`,
		);
	}
	if (view.results.length > 0) {
		lines.push(
			view.results.map((video, i) => videoText(video, i + 1)).join("\n\n"),
		);
	} else if (view.status === "ready") {
		lines.push("Nenhum vídeo encontrado sobre este assunto com esses filtros.");
	}
	return {
		content: [{ type: "text", text: lines.join("\n\n") }],
		structuredContent: { search: JSON.parse(JSON.stringify(view)) },
	};
}
