import type { Script } from "../../conteudo/content";
import type {
	AiCallMeta,
	RefineTurn,
	ScriptAi,
	ScriptBrief,
	WrittenScript,
} from "../ports/script-ai";

/** Dublê da IA: devolve um roteiro previsível e registra as chamadas. */
export class FakeScriptAi implements ScriptAi {
	readonly calls: {
		kind: "write" | "refine";
		meta: AiCallMeta;
		brief: ScriptBrief;
		history?: RefineTurn[];
		request?: string;
	}[] = [];
	failWith: Error | null = null;

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
	): Promise<{ reply: string; script: Script }> {
		this.calls.push({ kind: "refine", meta, brief, history, request });
		if (this.failWith) throw this.failWith;
		return {
			reply: `Ajustei: ${request}`,
			script: { ...brief.content.script, hook: `Novo gancho (${request})` },
		};
	}
}
