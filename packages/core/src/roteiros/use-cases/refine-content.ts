import type { Content } from "../../conteudo/content";
import { getContent } from "../../conteudo/use-cases/read-contents";
import { withQuota } from "../../cotas/with-quota";
import { assertCanEditContent } from "../../policies/approval.policy";
import { assertCanWrite } from "../../policies/permission.policy";
import type { ActorContext } from "../../shared/actor-context";
import { previewUnavailable, stalePreview } from "../errors";
import {
	mergeCitations,
	type PreviewDecision,
	type RefineMessage,
} from "../refinement";
import { briefFor, type ScriptDeps, scriptChange } from "./deps";

/** Quantas mensagens anteriores vão para a IA como contexto do refino. */
const HISTORY_FOR_AI = 20;
/** Quantas mensagens a tela e o MCP mostram. */
const CHAT_LIMIT = 50;

/**
 * Conversa de refino (✅ RN-006): a IA responde e propõe um roteiro, que fica como **prévia**
 * e não altera o card (📎 RN-073). Com `webSearch`, a IA pesquisa na web e devolve as fontes
 * (📎 RN-075). Consome cota de "refinar roteiro" (RN-303).
 */
export async function refineContent(
	deps: ScriptDeps,
	actor: ActorContext,
	contentId: string,
	request: string,
	options: { webSearch: boolean } = { webSearch: false },
): Promise<RefineMessage[]> {
	assertCanWrite(actor);
	const content = await getContent(deps, actor, contentId);
	// Refinar prepara uma mexida no roteiro: quem não pode editá-lo também não refina.
	assertCanEditContent(actor, content.approvalStatus);
	const history = await deps.scripts.listRefineMessages(
		actor.companyId,
		content.id,
		HISTORY_FOR_AI,
	);
	const brief = await briefFor(deps, actor, content);

	const result = await withQuota(deps, actor, "refine_content", () =>
		deps.scriptAi.refineScript(
			{ companyId: actor.companyId, tool: "refine_content" },
			brief,
			history.map(({ role, text, preview, sources }) => ({
				role,
				text,
				preview,
				sources,
			})),
			request,
			options,
		),
	);

	return deps.scripts.addRefineExchange(actor.companyId, content.id, {
		userId: actor.userId,
		request,
		reply: result.reply,
		preview: result.script,
		sources: result.sources,
		previewBaseVersion: content.contentVersion,
	});
}

/** Últimas mensagens do refino de um card. */
export async function getRefineChat(
	deps: Pick<ScriptDeps, "contents" | "scripts">,
	actor: ActorContext,
	contentId: string,
): Promise<RefineMessage[]> {
	const content = await getContent(deps, actor, contentId);
	return deps.scripts.listRefineMessages(
		actor.companyId,
		content.id,
		CHAT_LIMIT,
	);
}

/**
 * Aplica ou descarta a prévia, sem nova chamada de IA (📎 RN-073). Aplicar é recusado se o
 * card mudou depois da prévia (📎 RN-074) e soma as fontes da prévia às do card, sem tirar
 * nenhuma (📎 RN-075).
 */
export async function reviewContentRefinement(
	deps: Pick<ScriptDeps, "contents" | "scripts">,
	actor: ActorContext,
	contentId: string,
	messageId: string,
	decision: PreviewDecision,
): Promise<{ content: Content; message: RefineMessage }> {
	assertCanWrite(actor);
	const content = await getContent(deps, actor, contentId);
	const message = await deps.scripts.findRefineMessage(
		actor.companyId,
		content.id,
		messageId,
	);
	if (!message?.preview || message.previewStatus !== "pending") {
		throw previewUnavailable();
	}

	if (decision === "discard") {
		return {
			content,
			message: await deps.scripts.setPreviewStatus(
				actor.companyId,
				message.id,
				"discarded",
			),
		};
	}

	if (message.previewBaseVersion !== content.contentVersion) {
		throw stalePreview();
	}
	assertCanEditContent(actor, content.approvalStatus);
	const updated = await deps.contents.update(actor.companyId, content.id, {
		...scriptChange(actor, content, message.preview),
		citations: mergeCitations(content.citations, message.sources),
	});
	return {
		content: updated,
		message: await deps.scripts.setPreviewStatus(
			actor.companyId,
			message.id,
			"applied",
		),
	};
}
