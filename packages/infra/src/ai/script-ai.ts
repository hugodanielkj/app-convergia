import {
	type Citation,
	citationKey,
	type InstagramSnapshot,
	MAX_OPTIONS_PER_CALL,
	type RefineTurn,
	type Script,
	type ScriptAi,
	type ScriptBrief,
	type ScriptField,
} from "@convergia/core";
import { z } from "zod";
import type { LlmGateway, LlmMessage } from "./llm-gateway";

const writtenScript = z.object({
	hook: z.string().describe("Gancho: a primeira frase, que prende a atenção"),
	body: z.string().describe("Corpo do roteiro"),
	cta: z.string().describe("Chamada para ação"),
	caption: z.string().describe("Legenda do post"),
});

const refinement = z.object({
	reply: z
		.string()
		.describe("Resposta curta à pessoa, dizendo o que mudou no roteiro"),
	script: writtenScript.describe("O roteiro completo, já com as mudanças"),
	sources: z
		.array(z.object({ title: z.string(), url: z.string() }))
		.describe(
			"Páginas da busca na web que embasam o roteiro proposto. Vazio se não pesquisou",
		),
});

const optionSet = z.object({
	options: z
		.array(z.string())
		.min(1)
		.max(MAX_OPTIONS_PER_CALL)
		.describe("Opções diferentes entre si, cada uma pronta para usar"),
});

const FIELD_REQUEST: Record<ScriptField, string> = {
	hook: "ganchos (hook)",
	body: "corpos (body)",
	cta: "chamadas para ação (cta)",
	caption: "legendas (caption)",
};

// Fixo, para aproveitar o cache de prompt: nada que varia por card entra aqui.
const SYSTEM = `Você é roteirista de conteúdo orgânico para Instagram numa agência de marketing que atende empresas de qualquer segmento.
Escreva em português do Brasil, com linguagem natural, direta e adequada ao público da empresa.
Um roteiro tem quatro partes:
- hook: a primeira frase do post, que prende a atenção nos primeiros segundos.
- body: o desenvolvimento. Em reel ou story, escreva as falas e indique as cenas entre colchetes. Em carrossel, escreva o texto de cada lâmina em linhas começando por "Lâmina 1:", "Lâmina 2:" e assim por diante. Em imagem, o texto da arte.
- cta: a chamada para ação, uma frase.
- caption: a legenda do post, com no máximo 5 hashtags no fim.
Respeite a duração alvo quando ela for informada. Não invente dados, preços nem depoimentos da empresa.
Quando o roteiro já tiver fontes citadas, preserve as informações que vêm delas: não as apague nem as contradiga ao reescrever.
Quando o Instagram da empresa for informado, use-o para entender o nicho, o público e o tom de voz da marca. Os posts vêm dos que mais engajaram para os que menos engajaram: aproveite os temas e o jeito de falar que funcionam, sem copiar legendas. Não cite números do perfil no roteiro.`;

const WEB_SEARCH_ON =
	"Pesquise na web para embasar este pedido com dados atuais e confiáveis. Em sources, liste só as páginas da busca que você realmente usou no roteiro, com o endereço exato.";
const WEB_SEARCH_OFF = "Não pesquise na web neste pedido; deixe sources vazio.";

const MEDIA_LABEL: Record<string, string> = {
	reel: "reel",
	carousel: "carrossel",
	image: "imagem",
	story: "story",
};
const FUNNEL_LABEL: Record<string, string> = {
	top: "topo (atrair)",
	middle: "meio (engajar)",
	bottom: "fundo (converter)",
};

function scriptText(script: Script): string {
	return [
		`Gancho: ${script.hook ?? "(vazio)"}`,
		`Corpo: ${script.body ?? "(vazio)"}`,
		`CTA: ${script.cta ?? "(vazio)"}`,
		`Legenda: ${script.caption ?? "(vazio)"}`,
	].join("\n");
}

function citationLines(citations: Citation[]): string {
	return citations.map((c) => `- ${c.title} (${c.url})`).join("\n");
}

/** Legendas longas são cortadas: o tom aparece nas primeiras linhas. */
const CAPTION_CHARS = 300;
const ACCOUNT_LABEL = {
	business: "comercial",
	creator: "de criador de conteúdo",
};
const MEDIA_TYPE_LABEL = {
	image: "imagem",
	video: "vídeo",
	carousel: "carrossel",
};
const count = new Intl.NumberFormat("pt-BR");

function engagement(post: InstagramSnapshot["posts"][number]): number {
	return (post.likeCount ?? 0) + (post.commentsCount ?? 0);
}

/** ✅ RN-032, RN-039: perfil, legendas recentes e curtidas e comentários de cada post. */
export function instagramText({ profile, posts }: InstagramSnapshot): string {
	const numbers = [
		profile.followersCount !== null &&
			`${count.format(profile.followersCount)} seguidores`,
		profile.mediaCount !== null && `${count.format(profile.mediaCount)} posts`,
	].filter(Boolean);
	const header = `Instagram da empresa: @${profile.username}, conta ${ACCOUNT_LABEL[profile.accountType]}${numbers.length > 0 ? `, ${numbers.join(", ")}` : ""}`;
	const ranked = [...posts].sort((a, b) => engagement(b) - engagement(a));
	const postLines = ranked.map((post) => {
		const caption = post.caption
			? post.caption.replace(/\s+/g, " ").trim().slice(0, CAPTION_CHARS)
			: "(sem legenda)";
		const kind = post.mediaType ? `${MEDIA_TYPE_LABEL[post.mediaType]}, ` : "";
		const metrics = `${post.likeCount ?? "?"} curtidas, ${post.commentsCount ?? "?"} comentários`;
		return `- (${kind}${metrics}) ${caption}`;
	});
	return [
		header,
		profile.name && `Nome: ${profile.name}`,
		profile.biography && `Bio: ${profile.biography}`,
		profile.website && `Site: ${profile.website}`,
		postLines.length > 0 &&
			`Posts recentes, dos que mais engajaram para os que menos:\n${postLines.join("\n")}`,
	]
		.filter(Boolean)
		.join("\n");
}

function briefText({ companyName, instagram, content }: ScriptBrief): string {
	const lines = [
		`Empresa: ${companyName}`,
		instagram && instagramText(instagram),
		`Título: ${content.title}`,
		content.idea && `Ideia: ${content.idea}`,
		content.mediaType && `Tipo de mídia: ${MEDIA_LABEL[content.mediaType]}`,
		content.format && `Formato: ${content.format}`,
		content.category && `Categoria: ${content.category}`,
		content.funnelStage &&
			`Etapa do funil: ${FUNNEL_LABEL[content.funnelStage]}`,
		content.targetDurationSeconds &&
			`Duração alvo: ${content.targetDurationSeconds} segundos`,
		content.citations.length > 0 &&
			`Fontes já citadas no roteiro:\n${citationLines(content.citations)}`,
	];
	return lines.filter(Boolean).join("\n");
}

function turnMessage(turn: RefineTurn): LlmMessage {
	if (turn.role === "user") return { role: "user", content: turn.text };
	const preview = turn.preview
		? `\n\nRoteiro proposto:\n${scriptText(turn.preview)}`
		: "";
	const sources =
		turn.sources.length > 0
			? `\n\nFontes usadas:\n${citationLines(turn.sources)}`
			: "";
	return { role: "assistant", content: `${turn.text}${preview}${sources}` };
}

/**
 * 📎 RN-075: só vale como fonte uma página que a busca devolveu de fato. O título vem da busca,
 * não do modelo, e a mesma página não se repete.
 */
function confirmedSources(
	chosen: Citation[],
	searched: Citation[],
): Citation[] {
	const found = new Map(searched.map((page) => [citationKey(page.url), page]));
	const sources: Citation[] = [];
	for (const { url } of chosen) {
		const key = citationKey(url);
		const page = found.get(key);
		if (!page) continue;
		found.delete(key);
		sources.push({ title: page.title || page.url, url: page.url });
	}
	return sources;
}

/** Prompts de roteiro sobre o gateway de IA. Implementa a porta `ScriptAi` do core. */
export function createScriptAi(llm: LlmGateway): ScriptAi {
	return {
		async writeScript(meta, brief) {
			const { output } = await llm(meta, {
				task: "write_script",
				system: SYSTEM,
				messages: [
					{
						role: "user",
						content: `${briefText(brief)}\n\nEscreva o roteiro completo deste post.`,
					},
				],
				schema: writtenScript,
			});
			return output;
		},

		async refineScript(meta, brief, history, request, { webSearch }) {
			const { output, webResults } = await llm(meta, {
				task: "refine_script",
				system: SYSTEM,
				messages: [
					{
						role: "user",
						content: `${briefText(brief)}\n\nRoteiro atual do card:\n${scriptText(brief.content.script)}\n\nVamos refinar este roteiro. Em cada pedido, devolva o roteiro completo com as mudanças, partindo do último roteiro que você propôs.`,
					},
					...history.map(turnMessage),
					{
						role: "user",
						content: `${request}\n\n(${webSearch ? WEB_SEARCH_ON : WEB_SEARCH_OFF})`,
					},
				],
				schema: refinement,
				webSearch,
			});
			return {
				reply: output.reply,
				script: output.script,
				sources: webSearch ? confirmedSources(output.sources, webResults) : [],
			};
		},

		async suggestOptions(meta, brief, field) {
			const {
				output: { options },
			} = await llm(meta, {
				task: "suggest_options",
				system: SYSTEM,
				messages: [
					{
						role: "user",
						content: `${briefText(brief)}\n\nRoteiro atual do card:\n${scriptText(brief.content.script)}\n\nEscreva ${MAX_OPTIONS_PER_CALL} opções de ${FIELD_REQUEST[field]} para este post, com abordagens diferentes entre si. Cada opção deve combinar com o resto do roteiro.`,
					},
				],
				schema: optionSet,
			});
			return options;
		},
	};
}
