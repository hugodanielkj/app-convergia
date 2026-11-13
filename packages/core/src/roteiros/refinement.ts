import { z } from "zod";
import type { Script } from "../conteudo/content";

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
