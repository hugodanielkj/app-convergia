import { type AiCallMeta, type Citation, DomainError } from "@convergia/core";
import type { z } from "zod";
import type { Db } from "../db/client";
import { aiCallLog } from "../db/schema";
import { withCompany } from "../db/with-company";

export type LlmMessage = { role: "user" | "assistant"; content: string };

export type LlmTask =
	| "write_script"
	| "refine_script"
	| "suggest_options"
	| "expand_query";

export type LlmRequest<T> = {
	task: LlmTask;
	system: string;
	messages: LlmMessage[];
	/** Saída estruturada: o modelo responde neste formato e o gateway valida (stack §4). */
	schema: z.ZodType<T>;
	/** Deixa o modelo pesquisar na web antes de responder (📎 RN-075). */
	webSearch?: boolean;
};

export type LlmResult = {
	output: unknown;
	inputTokens: number | null;
	outputTokens: number | null;
	/** Páginas que a busca na web devolveu ao modelo nesta chamada. */
	webResults?: Citation[];
};

/** Saída validada e as páginas que a busca na web realmente devolveu (📎 RN-075). */
export type LlmOutput<T> = { output: T; webResults: Citation[] };

/** Fornecedor do modelo. Trocar de modelo ou de provedor muda só a implementação desta interface. */
export interface LlmClient {
	readonly model: string;
	complete<T>(request: LlmRequest<T>): Promise<LlmResult>;
}

export type LlmGateway = <T>(
	meta: AiCallMeta,
	request: LlmRequest<T>,
) => Promise<LlmOutput<T>>;

const AI_UNAVAILABLE =
	"A IA não conseguiu responder agora. Tente de novo em instantes.";

/**
 * Único caminho para a IA (stack §4): valida a saída e registra cada chamada em `ai_call_log`
 * com empresa, ferramenta, modelo, tokens, duração e resultado (design §10).
 */
export function createLlmGateway(db: Db, llm: LlmClient): LlmGateway {
	return async <T>(
		meta: AiCallMeta,
		request: LlmRequest<T>,
	): Promise<LlmOutput<T>> => {
		const started = performance.now();
		const log = async (entry: {
			success: boolean;
			inputTokens?: number | null;
			outputTokens?: number | null;
			error?: string;
		}) => {
			try {
				await withCompany(db, meta.companyId, (tx) =>
					tx.insert(aiCallLog).values({
						companyId: meta.companyId,
						tool: meta.tool,
						model: llm.model,
						durationMs: Math.round(performance.now() - started),
						...entry,
					}),
				);
			} catch (error) {
				// O registro de custo não pode derrubar a resposta ao usuário.
				console.error("Falha ao gravar ai_call_log", error);
			}
		};

		let result: LlmResult;
		let output: T;
		try {
			result = await llm.complete(request);
			output = request.schema.parse(result.output);
		} catch (error) {
			await log({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			console.error(`Chamada de IA falhou (${meta.tool})`, error);
			throw new DomainError("ai_unavailable", AI_UNAVAILABLE);
		}
		await log({
			success: true,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
		});
		return { output, webResults: result.webResults ?? [] };
	};
}
