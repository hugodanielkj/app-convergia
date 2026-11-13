import type { CreatorKind, Script, ScriptField } from "../conteudo/content";

/** Quantas gerações o histórico do card devolve, das mais novas para as mais antigas. */
export const HISTORY_LIMIT = 50;

type HistoryBase = {
	id: string;
	contentId: string;
	createdByUserId: string;
	createdByKind: CreatorKind;
	createdAt: Date;
};

/** 📎 RN-072: uma geração do card, de roteiro completo (RN-070) ou de opções avulsas (RN-071). */
export type HistoryEntry =
	| (HistoryBase & { kind: "script"; script: Script })
	| (HistoryBase & { kind: "options"; field: ScriptField; options: string[] });
