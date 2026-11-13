import type { Content, Script, ScriptField } from "../../conteudo/content";
import type { QuotaTool } from "../../policies/quota.policy";

/** Quem paga a chamada, para o registro de custo em `ai_call_log` (design §10). */
export type AiCallMeta = { companyId: string; tool: QuotaTool };

/** O que a IA sabe do card (✅ RN-076: sem módulo de marca, o contexto é o card e a empresa). */
export type ScriptBrief = {
	companyName: string;
	content: Pick<
		Content,
		| "title"
		| "idea"
		| "mediaType"
		| "format"
		| "category"
		| "funnelStage"
		| "targetDurationSeconds"
		| "script"
	>;
};

export type WrittenScript = {
	hook: string;
	body: string;
	cta: string;
	caption: string;
};

/** Turno anterior do refino. A resposta da IA leva a prévia que ela propôs. */
export type RefineTurn = {
	role: "user" | "assistant";
	text: string;
	preview: Script | null;
};

/** IA de texto para roteiros. Implementada pelo gateway de IA em `packages/infra`. */
export interface ScriptAi {
	writeScript(meta: AiCallMeta, brief: ScriptBrief): Promise<WrittenScript>;
	refineScript(
		meta: AiCallMeta,
		brief: ScriptBrief,
		history: RefineTurn[],
		request: string,
	): Promise<{ reply: string; script: Script }>;
	/** 📎 RN-071: até `MAX_OPTIONS_PER_CALL` opções para uma parte do roteiro. */
	suggestOptions(
		meta: AiCallMeta,
		brief: ScriptBrief,
		field: ScriptField,
	): Promise<string[]>;
}
