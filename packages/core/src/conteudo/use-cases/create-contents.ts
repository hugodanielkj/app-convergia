import {
	creatorKind,
	initialApprovalStatus,
} from "../../policies/approval.policy";
import { assertCanWrite } from "../../policies/permission.policy";
import type { ActorContext } from "../../shared/actor-context";
import { DomainError } from "../../shared/domain-error";
import type { Content, NewContentInput } from "../content";
import type {
	ContentRepository,
	NewContent,
} from "../ports/content-repository";
import { endOfColumn } from "./positions";

/** 📎 RN-064: criação em lote de 1 a 20 cards por chamada. */
export const MAX_BULK_CONTENTS = 20;

/** Cria cards sem IA e sem consumir cota (RN-064). */
export async function createContents(
	deps: { contents: ContentRepository },
	actor: ActorContext,
	inputs: NewContentInput[],
): Promise<Content[]> {
	assertCanWrite(actor);
	if (inputs.length < 1 || inputs.length > MAX_BULK_CONTENTS) {
		throw new DomainError("bulk_limit", "Crie de 1 a 20 cards por vez.");
	}
	const active = await deps.contents.listActive(actor.companyId);
	const rows: NewContent[] = [];
	for (const input of inputs) {
		const status = input.status ?? "idea";
		rows.push({
			createdByUserId: actor.userId,
			createdByKind: creatorKind(actor),
			title: input.title,
			idea: input.idea ?? null,
			script: {
				hook: input.script?.hook ?? null,
				body: input.script?.body ?? null,
				cta: input.script?.cta ?? null,
				caption: input.script?.caption ?? null,
			},
			platform: "instagram",
			mediaType: input.mediaType ?? null,
			format: input.format ?? null,
			category: input.category ?? null,
			funnelStage: input.funnelStage ?? null,
			targetDurationSeconds: input.targetDurationSeconds ?? null,
			status,
			position: endOfColumn([...active, ...rows], status),
			plannedDate: input.plannedDate ?? null,
			contentVersion: 1,
			approvalStatus: initialApprovalStatus(actor),
		});
	}
	return deps.contents.insertMany(actor.companyId, rows);
}
