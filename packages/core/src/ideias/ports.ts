import type { Content } from "../conteudo/content";
import type { AiCallMeta } from "../roteiros/ports/script-ai";
import type { ActorContext } from "../shared/actor-context";
import type { Idea, IdeaDraft } from "./idea";
export interface IdeaRepository {
	list(companyId: string): Promise<Idea[]>;
	find(companyId: string, id: string): Promise<Idea | null>;
	/** Substitui só as ativas; preserva histórico e cancela envios antigos na mesma transação. */
	replace(actor: ActorContext, drafts: IdeaDraft[], at: Date): Promise<Idea[]>;
	/** RN-082: cria no máximo um card, sem IA, na mesma transação da mudança de estado. */
	accept(actor: ActorContext, id: string, at: Date): Promise<Content | null>;
	dismiss(actor: ActorContext, id: string, at: Date): Promise<boolean>;
}
export interface BrainstormAi {
	generate(
		meta: AiCallMeta,
		companyName: string,
		brief: string,
	): Promise<IdeaDraft[]>;
}
