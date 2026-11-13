import type {
	Citation,
	CreatorKind,
	Script,
	ScriptField,
} from "../../conteudo/content";
import type { HistoryEntry } from "../history";
import type { ScriptRepository } from "../ports/script-repository";
import type { PreviewStatus, RefineMessage } from "../refinement";

/** Dublê do histórico de roteiros para testes unitários. */
export class InMemoryScriptRepository implements ScriptRepository {
	readonly generations: {
		companyId: string;
		contentId: string;
		script: Script;
		createdByUserId: string;
		createdByKind: CreatorKind;
	}[] = [];
	readonly optionSets: {
		companyId: string;
		contentId: string;
		field: ScriptField;
		options: string[];
		createdByUserId: string;
		createdByKind: CreatorKind;
	}[] = [];
	private readonly history: (HistoryEntry & { companyId: string })[] = [];
	readonly messages: RefineMessage[] = [];
	private sequence = 0;

	constructor(private readonly now: () => Date = () => new Date()) {}

	async addGeneration(
		companyId: string,
		generation: {
			contentId: string;
			script: Script;
			createdByUserId: string;
			createdByKind: CreatorKind;
		},
	): Promise<void> {
		this.generations.push({ companyId, ...generation });
		this.history.push({
			...generation,
			companyId,
			kind: "script",
			id: `gen-${++this.sequence}`,
			createdAt: this.now(),
		});
	}

	async addOptionSet(
		companyId: string,
		optionSet: {
			contentId: string;
			field: ScriptField;
			options: string[];
			createdByUserId: string;
			createdByKind: CreatorKind;
		},
	): Promise<void> {
		this.optionSets.push({ companyId, ...optionSet });
		this.history.push({
			...optionSet,
			companyId,
			kind: "options",
			id: `gen-${++this.sequence}`,
			createdAt: this.now(),
		});
	}

	async listHistory(
		companyId: string,
		contentId: string,
		limit: number,
	): Promise<HistoryEntry[]> {
		return this.history
			.filter((e) => e.companyId === companyId && e.contentId === contentId)
			.reverse()
			.slice(0, limit)
			.map(({ companyId: _, ...entry }) => structuredClone(entry));
	}

	async listRefineMessages(
		companyId: string,
		contentId: string,
		limit: number,
	): Promise<RefineMessage[]> {
		return this.messages
			.filter((m) => m.companyId === companyId && m.contentId === contentId)
			.slice(-limit)
			.map((m) => structuredClone(m));
	}

	async addRefineExchange(
		companyId: string,
		contentId: string,
		exchange: {
			userId: string;
			request: string;
			reply: string;
			preview: Script;
			sources: Citation[];
			previewBaseVersion: number;
		},
	): Promise<RefineMessage[]> {
		for (const m of this.messages) {
			if (
				m.companyId === companyId &&
				m.contentId === contentId &&
				m.previewStatus === "pending"
			) {
				m.previewStatus = "discarded";
			}
		}
		const base = {
			companyId,
			contentId,
			createdByUserId: exchange.userId,
			createdAt: this.now(),
		};
		const pair: RefineMessage[] = [
			{
				...base,
				id: `msg-${++this.sequence}`,
				role: "user",
				text: exchange.request,
				preview: null,
				sources: [],
				previewBaseVersion: null,
				previewStatus: null,
			},
			{
				...base,
				id: `msg-${++this.sequence}`,
				role: "assistant",
				text: exchange.reply,
				preview: exchange.preview,
				sources: exchange.sources,
				previewBaseVersion: exchange.previewBaseVersion,
				previewStatus: "pending",
			},
		];
		this.messages.push(...pair);
		return pair.map((m) => structuredClone(m));
	}

	async findRefineMessage(
		companyId: string,
		contentId: string,
		id: string,
	): Promise<RefineMessage | null> {
		const found = this.messages.find(
			(m) =>
				m.companyId === companyId && m.contentId === contentId && m.id === id,
		);
		return found ? structuredClone(found) : null;
	}

	async setPreviewStatus(
		companyId: string,
		id: string,
		status: PreviewStatus,
	): Promise<RefineMessage> {
		const found = this.messages.find(
			(m) => m.companyId === companyId && m.id === id,
		);
		if (!found) throw new Error(`Mensagem ${id} não existe nesta empresa.`);
		found.previewStatus = status;
		return structuredClone(found);
	}
}
