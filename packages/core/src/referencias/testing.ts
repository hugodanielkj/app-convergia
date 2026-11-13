import type { ContentSource, SourceRepository } from "../conteudo/source";
import type {
	CardReference,
	KnowledgeRepository,
	SavedReference,
} from "./knowledge";
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
	readonly saved: SavedReference[] = [];
	readonly attached: CardReference[] = [];
	async listSaved(companyId: string) {
		return structuredClone(this.saved.filter((r) => r.companyId === companyId));
	}
	async findSaved(companyId: string, id: string) {
		return structuredClone(
			this.saved.find((r) => r.companyId === companyId && r.id === id) ?? null,
		);
	}
	async deleteSaved(companyId: string, id: string) {
		const n = this.saved.findIndex(
			(r) => r.companyId === companyId && r.id === id,
		);
		if (n < 0) return false;
		this.saved.splice(n, 1);
		return true;
	}
	async listAttached(companyId: string, contentId: string) {
		return structuredClone(
			this.attached.filter(
				(r) => r.companyId === companyId && r.contentId === contentId,
			),
		);
	}
	async attach(
		companyId: string,
		contentId: string,
		input: Pick<CardReference, "title" | "url" | "kind">,
	) {
		const r = {
			id: `ref-${this.attached.length + 1}`,
			companyId,
			contentId,
			...input,
		};
		this.attached.push(r);
		return structuredClone(r);
	}
	async detach(companyId: string, contentId: string, id: string) {
		const n = this.attached.findIndex(
			(r) =>
				r.companyId === companyId && r.contentId === contentId && r.id === id,
		);
		if (n < 0) return false;
		this.attached.splice(n, 1);
		return true;
	}
}
export class InMemorySourceRepository implements SourceRepository {
	readonly rows: ContentSource[] = [];
	async list(companyId: string, contentId: string) {
		return structuredClone(
			this.rows.filter(
				(r) => r.companyId === companyId && r.contentId === contentId,
			),
		);
	}
	async find(companyId: string, contentId: string, id: string) {
		return structuredClone(
			this.rows.find(
				(r) =>
					r.companyId === companyId && r.contentId === contentId && r.id === id,
			) ?? null,
		);
	}
}
