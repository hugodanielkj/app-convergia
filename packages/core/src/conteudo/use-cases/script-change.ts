import { contentChangedMeanwhile } from "../../aprovacao/errors";
import {
	assertCanEditContent,
	creatorKind,
	onContentChanged,
} from "../../policies/approval.policy";
import type { ActorContext } from "../../shared/actor-context";
import type { Content, Script } from "../content";
import type {
	ContentPatch,
	ContentRepository,
} from "../ports/content-repository";

/**
 * Toda mexida no roteiro passa por aqui: confere quem pode mexer, aplica a política de
 * aprovação, incrementa a versão e grava o evento do histórico na mesma transação
 * (RN-203, RN-215, RN-216, design §9).
 */
export async function writeScriptChange(
	deps: { contents: ContentRepository },
	actor: ActorContext,
	content: Content,
	script: Script,
	extra: ContentPatch = {},
): Promise<Content> {
	assertCanEditContent(actor, content.approvalStatus);
	const effect = onContentChanged(actor, content.approvalStatus);
	const updated = await deps.contents.applyContentChange(
		actor.companyId,
		content.id,
		{
			...extra,
			script,
			approvalStatus: effect.approvalStatus,
			contentVersion: content.contentVersion + 1,
		},
		{
			expect: {
				contentVersion: content.contentVersion,
				approvalStatus: content.approvalStatus,
			},
			approvalEvent: effect.event && {
				type: effect.event,
				actorId: actor.userId,
				actorKind: creatorKind(actor),
			},
		},
	);
	if (!updated) throw contentChangedMeanwhile();
	return updated;
}
