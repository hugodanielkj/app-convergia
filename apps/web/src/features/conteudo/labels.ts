import type { ContentDto } from "../../api/client";

type Status = ContentDto["status"];
type Approval = ContentDto["approvalStatus"];

export const STATUS_ORDER: Status[] = ["idea", "draft", "edited", "published"];

/** Colunas do kanban (RN-061). */
export const STATUS_LABEL: Record<Status, string> = {
	idea: "Ideia",
	draft: "Rascunho",
	edited: "Editado",
	published: "Publicado",
};

/** Estado de aprovação do roteiro (regra de negócio §5.4). `none` não aparece. */
export const APPROVAL_BADGE: Record<
	Approval,
	{ label: string; className: string } | null
> = {
	none: null,
	in_preparation: {
		label: "Em preparo pela agência",
		className:
			"bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
	},
	pending: {
		label: "Aguardando aprovação",
		className: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
	},
	approved: {
		label: "Aprovado",
		className:
			"bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
	},
	rejected: {
		label: "Recusado",
		className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
	},
};

export const MEDIA_TYPE_LABEL: Record<
	NonNullable<ContentDto["mediaType"]>,
	string
> = {
	reel: "Reel",
	carousel: "Carrossel",
	image: "Imagem",
	story: "Story",
};

export const FUNNEL_STAGE_LABEL: Record<
	NonNullable<ContentDto["funnelStage"]>,
	string
> = {
	top: "Topo do funil",
	middle: "Meio do funil",
	bottom: "Fundo do funil",
};
