import type { ScriptField } from "../../conteudo/content";
import { getContent } from "../../conteudo/use-cases/read-contents";
import { withQuota } from "../../cotas/with-quota";
import {
	assertCanEditContent,
	creatorKind,
} from "../../policies/approval.policy";
import { assertCanWrite } from "../../policies/permission.policy";
import { OPTION_QUOTA_TOOLS } from "../../policies/quota.policy";
import type { ActorContext } from "../../shared/actor-context";
import { optionCountOutOfRange } from "../errors";
import { MAX_OPTIONS_PER_CALL, type ScriptOptions } from "../refinement";
import { briefFor, type ScriptDeps } from "./deps";

/**
 * Gera até 3 opções avulsas de gancho, corpo, CTA ou legenda (📎 RN-071) e guarda no
 * histórico do card (RN-072). Não altera o roteiro: quem escolhe uma opção salva o card,
 * e é essa edição que passa pela aprovação (RN-203). Cada parte tem a própria cota.
 */
export async function generateScriptOptions(
	deps: ScriptDeps,
	actor: ActorContext,
	contentId: string,
	field: ScriptField,
	count: number = MAX_OPTIONS_PER_CALL,
): Promise<ScriptOptions> {
	assertCanWrite(actor);
	if (!Number.isInteger(count) || count < 1 || count > MAX_OPTIONS_PER_CALL) {
		throw optionCountOutOfRange();
	}
	const content = await getContent(deps, actor, contentId);
	assertCanEditContent(actor, content.approvalStatus);
	const brief = await briefFor(deps, actor, content);
	const tool = OPTION_QUOTA_TOOLS[field];

	const suggested = await withQuota(deps, actor, tool, () =>
		deps.scriptAi.suggestOptions(
			{ companyId: actor.companyId, tool },
			brief,
			field,
		),
	);
	const options = suggested.slice(0, count);

	await deps.scripts.addOptionSet(actor.companyId, {
		contentId: content.id,
		field,
		options,
		createdByUserId: actor.userId,
		createdByKind: creatorKind(actor),
	});
	return { contentId: content.id, field, options };
}
