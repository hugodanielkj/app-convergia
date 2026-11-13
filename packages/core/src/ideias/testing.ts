import { InMemoryContentRepository } from "../conteudo/testing/in-memory-content-repository";
import { createContents } from "../conteudo/use-cases/create-contents";
import type { ActorContext } from "../shared/actor-context";
import { type Idea, type IdeaDraft, ideaApprovalSubject } from "./idea";
import type { BrainstormAi, IdeaRepository } from "./ports";
export class FakeBrainstormAi implements BrainstormAi {
	fail = false;
	async generate() {
		if (this.fail) throw new Error("IA indisponível");
		return [
			{
				title: "Bastidores",
				text: "Mostre como o produto é feito.",
				reason: "Aproxima o público da empresa.",
			},
		];
	}
}
export class InMemoryIdeaRepository implements IdeaRepository {
	readonly rows: Idea[] = [];
	private sequence = 0;
	readonly subjects = new InMemoryContentRepository();
	constructor(private readonly contents: InMemoryContentRepository) {}
	async list(companyId: string) {
		return Promise.all(
			this.rows
				.filter((i) => i.companyId === companyId && i.state === "active")
				.map((i) => this.current(i)),
		);
	}
	private current(idea: Idea): Idea {
		const subject = this.subjects.rows.find((s) => s.id === idea.id);
		return structuredClone({
			...idea,
			...(subject
				? {
						approvalStatus: subject.approvalStatus,
						currentApprovalRequestId: subject.currentApprovalRequestId,
					}
				: {}),
		});
	}
	async find(companyId: string, id: string) {
		const i = this.rows.find((i) => i.companyId === companyId && i.id === id);
		return i ? this.current(i) : null;
	}
	async replace(actor: ActorContext, drafts: IdeaDraft[], at: Date) {
		for (const i of this.rows)
			if (i.companyId === actor.companyId && i.state === "active") {
				i.state = "dismissed";
				const s = this.subjects.rows.find((s) => s.id === i.id);
				if (s) s.deletedAt = at;
			}
		const added = drafts.map((d) => ({
			...d,
			id: `idea-${++this.sequence}`,
			companyId: actor.companyId,
			createdByUserId: actor.userId,
			createdByKind:
				actor.kind === "agency_member"
					? ("agency" as const)
					: ("client" as const),
			contentVersion: 1,
			approvalStatus:
				actor.kind === "agency_member"
					? ("in_preparation" as const)
					: ("none" as const),
			currentApprovalRequestId: null,
			state: "active" as const,
			contentId: null,
			createdAt: at,
			updatedAt: at,
		}));
		this.rows.push(...added);
		this.subjects.rows.push(...added.map(ideaApprovalSubject));
		return structuredClone(added);
	}
	async accept(actor: ActorContext, id: string) {
		const i = this.rows.find(
			(i) => i.companyId === actor.companyId && i.id === id,
		);
		if (!i) return null;
		if (i.contentId) return this.contents.find(actor.companyId, i.contentId);
		const current = this.current(i);
		if (
			i.state !== "active" ||
			!["none", "approved"].includes(current.approvalStatus)
		)
			return null;
		const [card] = await createContents({ contents: this.contents }, actor, [
			{ title: i.title, idea: i.text },
		]);
		if (!card) return null;
		i.state = "added";
		i.contentId = card.id;
		const s = this.subjects.rows.find((s) => s.id === id);
		if (s) s.deletedAt = new Date();
		return card;
	}
	async dismiss(actor: ActorContext, id: string, at: Date) {
		const i = this.rows.find(
			(i) =>
				i.companyId === actor.companyId && i.id === id && i.state === "active",
		);
		if (!i) return false;
		i.state = "dismissed";
		const s = this.subjects.rows.find((s) => s.id === id);
		if (s) s.deletedAt = at;
		return true;
	}
}
