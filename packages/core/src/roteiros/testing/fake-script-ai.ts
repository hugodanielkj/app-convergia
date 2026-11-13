import type { Citation, ScriptField } from "../../conteudo/content";
import type {
	AiCallMeta,
	Refinement,
	RefineTurn,
	ScriptAi,
	ScriptBrief,
	WrittenScript,
} from "../ports/script-ai";

/** Dublê da IA: devolve um roteiro previsível e registra as chamadas. */
export class FakeScriptAi implements ScriptAi {
	readonly calls: {
		kind: "write" | "refine" | "options";
		meta: AiCallMeta;
		brief: ScriptBrief;
		history?: RefineTurn[];
		request?: string;
		webSearch?: boolean;
		field?: ScriptField;
	}[] = [];
	failWith: Error | null = null;
	/** Fontes devolvidas quando o refino pesquisa na web; `null` usa uma fonte de exemplo. */
	sources: Citation[] | null = null;

	async writeScript(
		meta: AiCallMeta,
		brief: ScriptBrief,
	): Promise<WrittenScript> {
		this.calls.push({ kind: "write", meta, brief });
		if (this.failWith) throw this.failWith;
		const title = brief.content.title;
		return {
			hook: `Gancho sobre ${title}`,
			body: `Corpo sobre ${title}`,
			cta: "Salve este post",
			caption: `Legenda sobre ${title}`,
		};
	}

	async refineScript(
		meta: AiCallMeta,
		brief: ScriptBrief,
		history: RefineTurn[],
		request: string,
		{ webSearch }: { webSearch: boolean },
	): Promise<Refinement> {
		this.calls.push({
			kind: "refine",
			meta,
			brief,
			history,
			request,
			webSearch,
		});
		if (this.failWith) throw this.failWith;
		return {
			reply: `Ajustei: ${request}`,
			script: { ...brief.content.script, hook: `Novo gancho (${request})` },
			sources: webSearch
				? (this.sources ?? [
						{
							title: `Fonte sobre ${request}`,
							url: "https://example.com/fonte",
						},
					])
				: [],
		};
	}

	async suggestOptions(
		meta: AiCallMeta,
		brief: ScriptBrief,
		field: ScriptField,
	): Promise<string[]> {
		this.calls.push({ kind: "options", meta, brief, field });
		if (this.failWith) throw this.failWith;
		return [1, 2, 3].map(
			(n) => `Opção ${n} de ${field} sobre ${brief.content.title}`,
		);
	}
}
