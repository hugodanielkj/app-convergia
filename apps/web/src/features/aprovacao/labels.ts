import type { ApprovalEventDto } from "../../api/client";

/** ✅ RN-230: o que aconteceu em cada passo do histórico. */
export const EVENT_LABEL: Record<ApprovalEventDto["type"], string> = {
	submitted: "Enviado para aprovação",
	updated_while_pending: "Roteiro atualizado pela agência durante a aprovação",
	cancelled: "Envio cancelado pela agência",
	approved: "Aprovado pelo cliente",
	approved_on_behalf: "Aprovado pela agência em nome do cliente",
	rejected: "Recusado pelo cliente",
	approval_lost: "Perdeu a aprovação: a agência mexeu no roteiro",
};

const moment = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
});

/** Ex.: "13 de nov., 14:05" */
export function momentLabel(iso: string): string {
	return moment.format(new Date(iso));
}
