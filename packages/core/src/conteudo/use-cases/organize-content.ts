import {
	creatorKind,
	initialApprovalStatus,
} from "../../policies/approval.policy";
import {
	assertCanDelete,
	assertCanMoveTo,
	trashCutoff,
} from "../../policies/content.policy";
import { assertCanWrite } from "../../policies/permission.policy";
import type { ActorContext } from "../../shared/actor-context";
import { DomainError } from "../../shared/domain-error";
import type { Content, MoveContentInput } from "../content";
import { contentNotFound } from "../errors";
import type { ContentRepository } from "../ports/content-repository";
import { endOfColumn, positionAt } from "./positions";
import { getContent } from "./read-contents";

type Deps = { contents: ContentRepository };

/** Kanban: muda de coluna e/ou de posição. Não é mexida de conteúdo (RN-203). */
export async function moveContent(
	deps: Deps,
	actor: ActorContext,
	id: string,
	input: MoveContentInput,
): Promise<Content> {
	assertCanWrite(actor);
	const content = await getContent(deps, actor, id);
	assertCanMoveTo(content, input.status);
	const column = (
		await deps.contents.listActive(actor.companyId, { status: input.status })
	)
		.filter((card) => card.id !== id)
		.map((card) => card.position);
	const index = Math.min(input.index ?? column.length, column.length);
	return deps.contents.update(actor.companyId, id, {
		status: input.status,
		position: positionAt(column, index),
	});
}

/** Data no calendário. Só organiza, nunca publica, e não passa por aprovação (RN-062, RN-063). */
export async function scheduleContent(
	deps: Deps,
	actor: ActorContext,
	id: string,
	plannedDate: string | null,
): Promise<Content> {
	assertCanWrite(actor);
	await getContent(deps, actor, id);
	return deps.contents.update(actor.companyId, id, { plannedDate });
}

/** 📎 RN-065: copia o conteúdo editorial para o fim da coluna ideia, sem data. */
export async function duplicateContent(
	deps: Deps,
	actor: ActorContext,
	id: string,
): Promise<Content> {
	assertCanWrite(actor);
	const original = await getContent(deps, actor, id);
	const active = await deps.contents.listActive(actor.companyId, {
		status: "idea",
	});
	const [copy] = await deps.contents.insertMany(actor.companyId, [
		{
			createdByUserId: actor.userId,
			createdByKind: creatorKind(actor),
			title: original.title,
			idea: original.idea,
			script: { ...original.script },
			citations: original.citations.map((citation) => ({ ...citation })),
			platform: original.platform,
			mediaType: original.mediaType,
			format: original.format,
			category: original.category,
			funnelStage: original.funnelStage,
			targetDurationSeconds: original.targetDurationSeconds,
			status: "idea",
			position: endOfColumn(active, "idea"),
			plannedDate: null,
			contentVersion: 1,
			approvalStatus: initialApprovalStatus(actor),
		},
	]);
	if (!copy) throw new Error("A cópia do card não foi gravada.");
	return copy;
}

/** RN-069: manda para a lixeira. RN-018: o cliente só exclui o que criou. */
export async function deleteContent(
	deps: Deps & { now: () => Date },
	actor: ActorContext,
	id: string,
): Promise<Content> {
	assertCanWrite(actor);
	const content = await getContent(deps, actor, id);
	assertCanDelete(actor, content);
	return deps.contents.update(actor.companyId, id, { deletedAt: deps.now() });
}

/** RN-069: restaura um card excluído há até 30 dias. */
export async function restoreContent(
	deps: Deps & { now: () => Date },
	actor: ActorContext,
	id: string,
): Promise<Content> {
	assertCanWrite(actor);
	const content = await deps.contents.find(actor.companyId, id);
	if (!content) throw contentNotFound();
	if (!content.deletedAt) return content;
	assertCanDelete(actor, content);
	if (content.deletedAt < trashCutoff(deps.now())) {
		throw new DomainError(
			"trash_expired",
			"Este card ficou mais de 30 dias na lixeira e não pode mais ser restaurado.",
		);
	}
	return deps.contents.update(actor.companyId, id, { deletedAt: null });
}
