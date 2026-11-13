import type { CreatorKind, Script, ScriptField } from "../../conteudo/content";
import type { HistoryEntry } from "../history";
import type { PreviewStatus, RefineMessage } from "../refinement";

/** Histórico de gerações e conversa de refino. Toda operação recebe a empresa (RN-015). */
export interface ScriptRepository {
	/** 📎 RN-072: toda geração fica no histórico do card. */
	addGeneration(
		companyId: string,
		generation: {
			contentId: string;
			script: Script;
			createdByUserId: string;
			createdByKind: CreatorKind;
		},
	): Promise<void>;
	/** 📎 RN-072: as opções avulsas (RN-071) também ficam no histórico do card. */
	addOptionSet(
		companyId: string,
		optionSet: {
			contentId: string;
			field: ScriptField;
			options: string[];
			createdByUserId: string;
			createdByKind: CreatorKind;
		},
	): Promise<void>;
	/** 📎 RN-072: as últimas `limit` gerações do card, das mais novas para as mais antigas. */
	listHistory(
		companyId: string,
		contentId: string,
		limit: number,
	): Promise<HistoryEntry[]>;
	/** As últimas `limit` mensagens do refino, da mais antiga para a mais nova. */
	listRefineMessages(
		companyId: string,
		contentId: string,
		limit: number,
	): Promise<RefineMessage[]>;
	/**
	 * Grava o pedido e a resposta com a prévia. Prévias pendentes anteriores do card passam a
	 * descartadas: só a mais nova pode ser aplicada.
	 */
	addRefineExchange(
		companyId: string,
		contentId: string,
		exchange: {
			userId: string;
			request: string;
			reply: string;
			preview: Script;
			previewBaseVersion: number;
		},
	): Promise<RefineMessage[]>;
	findRefineMessage(
		companyId: string,
		contentId: string,
		id: string,
	): Promise<RefineMessage | null>;
	setPreviewStatus(
		companyId: string,
		id: string,
		status: PreviewStatus,
	): Promise<RefineMessage>;
}
