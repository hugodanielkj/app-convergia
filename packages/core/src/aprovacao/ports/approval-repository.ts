import type { ApprovalStatus, Script } from "../../conteudo/content";
import type {
	ApprovalEvent,
	ApprovalEventDraft,
	ApprovalRequest,
} from "../approval";

/**
 * Solicitações de aprovação e o histórico delas (RN-230). Cada escrita muda a solicitação, o
 * estado do card e o histórico numa transação só, e só se o card ainda está como o caso de uso
 * o leu: devolve `null` quando ele mudou nesse meio-tempo (design §9).
 */
export interface ApprovalRepository {
	/** RN-210: abre a solicitação pendente com a cópia do roteiro e põe o card em `pending`. */
	submit(
		companyId: string,
		input: {
			contentId: string;
			expect: { contentVersion: number; approvalStatus: ApprovalStatus };
			snapshot: Script;
			event: ApprovalEventDraft<"submitted">;
			at: Date;
		},
	): Promise<ApprovalRequest | null>;
	/** Fecha a solicitação pendente (aprovada, recusada ou cancelada) e muda o estado do card. */
	decide(
		companyId: string,
		input: {
			contentId: string;
			requestId: string;
			/** Versão que quem decide revisou; sem ela, decide sobre a versão atual. */
			expectVersion: number | null;
			outcome: "approved" | "rejected" | "cancelled";
			contentStatus: ApprovalStatus;
			onBehalf: boolean;
			reason: string | null;
			event: ApprovalEventDraft<
				"approved" | "approved_on_behalf" | "rejected" | "cancelled"
			>;
			at: Date;
		},
	): Promise<ApprovalRequest | null>;
	findMany(companyId: string, ids: string[]): Promise<ApprovalRequest[]>;
	/** O histórico do card, do mais antigo para o mais novo. */
	listEvents(companyId: string, contentId: string): Promise<ApprovalEvent[]>;
}
