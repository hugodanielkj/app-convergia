import { getContent } from "../../conteudo/use-cases/read-contents";
import { assertCanSeeHistory } from "../../policies/approval.policy";
import type { ActorContext } from "../../shared/actor-context";
import { HISTORY_LIMIT, type HistoryEntry } from "../history";
import type { ScriptDeps } from "./deps";

/**
 * 📎 RN-072: histórico de gerações do card, das mais novas para as mais antigas: roteiros
 * completos (RN-070) e opções avulsas (RN-071). Só leitura; não consome cota.
 */
export async function listContentGenerations(
	deps: Pick<ScriptDeps, "contents" | "scripts">,
	actor: ActorContext,
	contentId: string,
): Promise<HistoryEntry[]> {
	const content = await getContent(deps, actor, contentId);
	const entries = await deps.scripts.listHistory(
		actor.companyId,
		content.id,
		HISTORY_LIMIT,
	);
	assertCanSeeHistory(actor, entries);
	return entries;
}
