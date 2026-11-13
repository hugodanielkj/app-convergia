import { z } from "zod";
import { SCRIPT_FIELDS, type Script } from "../conteudo/content";

/** Estado da prévia de um refino (📎 RN-073). */
export type PreviewStatus = "pending" | "applied" | "discarded";

/** Uma mensagem da conversa de refino de um card. A resposta da IA traz a prévia. */
export type RefineMessage = {
	id: string;
	companyId: string;
	contentId: string;
	role: "user" | "assistant";
	text: string;
	/** Roteiro proposto pela IA. Não altera o card até ser aplicado (RN-073). */
	preview: Script | null;
	/** `contentVersion` do card quando a prévia foi gerada (RN-074). */
	previewBaseVersion: number | null;
	previewStatus: PreviewStatus | null;
	createdByUserId: string;
	createdAt: Date;
};

export const MAX_SCRIPTS_PER_CALL = 5;

/** 📎 RN-071: até 3 opções avulsas por chamada. */
export const MAX_OPTIONS_PER_CALL = 3;

/** Pedido de opções avulsas. Validado nas bordas: API do app e MCP. */
export const scriptOptionsInput = z.object({
	field: z.enum(SCRIPT_FIELDS),
	count: z
		.number()
		.int()
		.min(1)
		.max(MAX_OPTIONS_PER_CALL)
		.default(MAX_OPTIONS_PER_CALL)
		.describe(`Quantas opções gerar (1 a ${MAX_OPTIONS_PER_CALL})`),
});

/** Opções avulsas geradas para uma parte do roteiro. Não alteram o card (RN-071). */
export type ScriptOptions = {
	contentId: string;
	field: (typeof SCRIPT_FIELDS)[number];
	options: string[];
};

/** Pedido de refino. Validado nas bordas: API do app e MCP. */
export const refineContentInput = z.object({
	message: z
		.string()
		.trim()
		.min(1)
		.max(2_000)
		.describe("O que mudar no roteiro, em linguagem natural"),
});

export const PREVIEW_DECISIONS = ["apply", "discard"] as const;
export type PreviewDecision = (typeof PREVIEW_DECISIONS)[number];
