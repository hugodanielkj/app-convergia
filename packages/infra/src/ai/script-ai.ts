import {
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
Respeite a duração alvo quando ela for informada. Não invente dados, preços nem depoimentos da empresa.`;

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

function briefText({ companyName, content }: ScriptBrief): string {
	const lines = [
		`Empresa: ${companyName}`,
		`Título: ${content.title}`,
		content.idea && `Ideia: ${content.idea}`,
		content.mediaType && `Tipo de mídia: ${MEDIA_LABEL[content.mediaType]}`,
		content.format && `Formato: ${content.format}`,
		content.category && `Categoria: ${content.category}`,
		content.funnelStage &&
			`Etapa do funil: ${FUNNEL_LABEL[content.funnelStage]}`,
		content.targetDurationSeconds &&
			`Duração alvo: ${content.targetDurationSeconds} segundos`,
	];
	return lines.filter(Boolean).join("\n");
}

function turnMessage(turn: RefineTurn): LlmMessage {
	if (turn.role === "user") return { role: "user", content: turn.text };
	const preview = turn.preview
		? `\n\nRoteiro proposto:\n${scriptText(turn.preview)}`
		: "";
	return { role: "assistant", content: `${turn.text}${preview}` };
}

/** Prompts de roteiro sobre o gateway de IA. Implementa a porta `ScriptAi` do core. */
export function createScriptAi(llm: LlmGateway): ScriptAi {
	return {
		writeScript(meta, brief) {
			return llm(meta, {
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
		},

		refineScript(meta, brief, history, request) {
			return llm(meta, {
				task: "refine_script",
				system: SYSTEM,
				messages: [
					{
						role: "user",
						content: `${briefText(brief)}\n\nRoteiro atual do card:\n${scriptText(brief.content.script)}\n\nVamos refinar este roteiro. Em cada pedido, devolva o roteiro completo com as mudanças, partindo do último roteiro que você propôs.`,
					},
					...history.map(turnMessage),
					{ role: "user", content: request },
				],
				schema: refinement,
			});
		},

		async suggestOptions(meta, brief, field) {
			const { options } = await llm(meta, {
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
