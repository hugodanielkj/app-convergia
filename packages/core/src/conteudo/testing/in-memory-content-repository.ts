import type { Content } from "../content";
import type {
	ContentPatch,
	ContentRepository,
	NewContent,
} from "../ports/content-repository";

/** Dublê do repositório de cards para testes unitários. */
export class InMemoryContentRepository implements ContentRepository {
	readonly rows: Content[] = [];
	private sequence = 0;

	constructor(private readonly now: () => Date = () => new Date()) {}

	async listActive(
		companyId: string,
		filter: { status?: string; plannedFrom?: string; plannedTo?: string } = {},
	): Promise<Content[]> {
		return this.rows
			.filter(
				(c) =>
					c.companyId === companyId &&
					!c.deletedAt &&
					(!filter.status || c.status === filter.status) &&
					(!filter.plannedFrom ||
						(c.plannedDate !== null && c.plannedDate >= filter.plannedFrom)) &&
					(!filter.plannedTo ||
						(c.plannedDate !== null && c.plannedDate <= filter.plannedTo)),
			)
			.sort(
				(a, b) => a.status.localeCompare(b.status) || a.position - b.position,
			)
			.map((c) => structuredClone(c));
	}

	async listDeleted(companyId: string, since: Date): Promise<Content[]> {
		return this.rows
			.filter(
				(c) => c.companyId === companyId && c.deletedAt && c.deletedAt >= since,
			)
			.map((c) => structuredClone(c));
	}

	async find(companyId: string, id: string): Promise<Content | null> {
		const row = this.rows.find((c) => c.companyId === companyId && c.id === id);
		return row ? structuredClone(row) : null;
	}

	async insertMany(
		companyId: string,
		contents: NewContent[],
	): Promise<Content[]> {
		const created = contents.map((content) => {
			this.sequence += 1;
			return {
				...content,
				id: `content-${this.sequence}`,
				companyId,
				deletedAt: null,
				createdAt: this.now(),
				updatedAt: this.now(),
			};
		});
		this.rows.push(...created);
		return created.map((c) => structuredClone(c));
	}

	async update(
		companyId: string,
		id: string,
		patch: ContentPatch,
	): Promise<Content> {
		const row = this.rows.find((c) => c.companyId === companyId && c.id === id);
		if (!row) throw new Error(`Card ${id} não existe.`);
		Object.assign(row, patch, { updatedAt: this.now() });
		return structuredClone(row);
	}
}
