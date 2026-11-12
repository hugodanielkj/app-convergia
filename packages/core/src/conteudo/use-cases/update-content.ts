import {
	assertCanEditContent,
	onContentChanged,
} from "../../policies/approval.policy";
import { assertCanWrite } from "../../policies/permission.policy";
import type { ActorContext } from "../../shared/actor-context";
import {
	type Content,
	type ContentUpdateInput,
	SCRIPT_FIELDS,
	type Script,
} from "../content";
import type {
	ContentPatch,
	ContentRepository,
} from "../ports/content-repository";
import { getContent } from "./read-contents";

/**
 * Edita os campos editoriais. Mudar o roteiro é mexida de conteúdo: passa pela política de
 * aprovação e incrementa `contentVersion` (RN-203). Os outros campos, não.
 */
export async function updateContent(
	deps: { contents: ContentRepository },
	actor: ActorContext,
	id: string,
	input: ContentUpdateInput,
): Promise<Content> {
	assertCanWrite(actor);
	const content = await getContent(deps, actor, id);
	const { script: scriptInput, ...fields } = input;
	const patch: ContentPatch = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) {
			Object.assign(patch, { [key]: value });
		}
	}

	const nextScript: Script = { ...content.script };
	for (const field of SCRIPT_FIELDS) {
		const value = scriptInput?.[field];
		if (value !== undefined) nextScript[field] = value;
	}
	const scriptChanged = SCRIPT_FIELDS.some(
		(field) => nextScript[field] !== content.script[field],
	);
	if (scriptChanged) {
		assertCanEditContent(actor, content.approvalStatus);
		const effect = onContentChanged(actor, content.approvalStatus);
		// O histórico (effect.event) entra com o módulo de aprovação; até lá nada fica pendente
		// nem aprovado, então os eventos ainda não acontecem.
		patch.script = nextScript;
		patch.approvalStatus = effect.approvalStatus;
		patch.contentVersion = content.contentVersion + 1;
	}

	if (Object.keys(patch).length === 0) {
		return content;
	}
	return deps.contents.update(actor.companyId, id, patch);
}
