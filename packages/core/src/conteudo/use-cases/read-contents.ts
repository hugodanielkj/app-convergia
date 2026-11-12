import { trashCutoff } from "../../policies/content.policy";
import type { ActorContext } from "../../shared/actor-context";
import type { CalendarRange, Content, KanbanStatus } from "../content";
import { contentNotFound } from "../errors";
import type { ContentRepository } from "../ports/content-repository";

type Deps = { contents: ContentRepository };

/** Cards da empresa, por coluna e posição (kanban). */
export function listContents(
	deps: Deps,
	actor: ActorContext,
	filter: { status?: KanbanStatus } = {},
): Promise<Content[]> {
	return deps.contents.listActive(actor.companyId, filter);
}

/** Um card fora da lixeira (RN-015). */
export async function getContent(
	deps: Deps,
	actor: ActorContext,
	id: string,
): Promise<Content> {
	const content = await deps.contents.find(actor.companyId, id);
	if (!content || content.deletedAt) {
		throw contentNotFound();
	}
	return content;
}

/** Cards com data de planejamento no intervalo (RN-062). */
export function getCalendar(
	deps: Deps,
	actor: ActorContext,
	range: CalendarRange,
): Promise<Content[]> {
	return deps.contents.listActive(actor.companyId, {
		plannedFrom: range.from,
		plannedTo: range.to,
	});
}

/** Lixeira: cards excluídos que ainda podem ser restaurados (RN-069). */
export function listDeletedContents(
	deps: Deps & { now: () => Date },
	actor: ActorContext,
): Promise<Content[]> {
	return deps.contents.listDeleted(actor.companyId, trashCutoff(deps.now()));
}
