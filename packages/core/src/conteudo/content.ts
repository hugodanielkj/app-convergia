import { z } from "zod";

/** 📎 RN-061: colunas do kanban, na ordem. */
export const KANBAN_STATUSES = [
	"idea",
	"draft",
	"edited",
	"published",
] as const;
export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

/** Tipos de mídia do Instagram (RN-060). */
export const MEDIA_TYPES = ["reel", "carousel", "image", "story"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Etapa do funil (RN-060). */
export const FUNNEL_STAGES = ["top", "middle", "bottom"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** Estado de aprovação do roteiro (regra de negócio §5.4; design §5.2). */
export const APPROVAL_STATUSES = [
	"none",
	"in_preparation",
	"pending",
	"approved",
	"rejected",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type CreatorKind = "agency" | "client";

/** Roteiro do card: é o que passa por aprovação (RN-201). */
export type Script = {
	hook: string | null;
	body: string | null;
	cta: string | null;
	caption: string | null;
};

export const SCRIPT_FIELDS = ["hook", "body", "cta", "caption"] as const;

/** Card: a unidade de conteúdo (RN-060). */
export type Content = {
	id: string;
	companyId: string;
	createdByUserId: string;
	createdByKind: CreatorKind;
	title: string;
	idea: string | null;
	script: Script;
	platform: "instagram";
	mediaType: MediaType | null;
	format: string | null;
	category: string | null;
	funnelStage: FunnelStage | null;
	targetDurationSeconds: number | null;
	status: KanbanStatus;
	position: number;
	/** Data de planejamento (AAAA-MM-DD). Só organiza; nunca publica (RN-062). */
	plannedDate: string | null;
	/** Muda só quando o roteiro muda (RN-203). */
	contentVersion: number;
	approvalStatus: ApprovalStatus;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => text(max).nullable().optional();
const isoDate = z.iso.date();

const scriptInput = z
	.object({
		hook: optionalText(2_000).describe(
			"Gancho: a primeira frase, que prende a atenção",
		),
		body: optionalText(20_000).describe("Corpo do roteiro"),
		cta: optionalText(2_000).describe("Chamada para ação"),
		caption: optionalText(5_000).describe("Legenda do post"),
	})
	.partial();

const editorialFields = {
	idea: optionalText(5_000).describe("A ideia do post, em poucas linhas"),
	script: scriptInput
		.optional()
		.describe("Roteiro. Mexida da agência exige aprovação do cliente (RN-203)"),
	mediaType: z
		.enum(MEDIA_TYPES)
		.nullable()
		.optional()
		.describe("Tipo de mídia: reel, carousel, image ou story"),
	format: optionalText(100).describe(
		"Formato livre (ex.: tutorial, bastidores)",
	),
	category: optionalText(100).describe(
		"Categoria livre (ex.: produto, educativo)",
	),
	funnelStage: z
		.enum(FUNNEL_STAGES)
		.nullable()
		.optional()
		.describe("Etapa do funil: top, middle ou bottom"),
	targetDurationSeconds: z
		.number()
		.int()
		.min(1)
		.max(3_600)
		.nullable()
		.optional()
		.describe("Duração alvo em segundos"),
};

/** Entrada para criar um card (RN-064). Validada nas bordas: API do app e MCP. */
export const newContentInput = z.object({
	title: text(200).describe("Título do card"),
	...editorialFields,
	status: z
		.enum(KANBAN_STATUSES)
		.optional()
		.describe(
			"Coluna do kanban: idea, draft, edited ou published. Padrão: idea",
		),
	plannedDate: isoDate
		.nullable()
		.optional()
		.describe("Data de planejamento (AAAA-MM-DD). Só organiza; não publica"),
});
export type NewContentInput = z.infer<typeof newContentInput>;

/** Campos editoriais que podem ser alterados. Coluna e data têm ações próprias. */
export const contentUpdateInput = z.object({
	title: text(200).optional().describe("Título do card"),
	...editorialFields,
});
export type ContentUpdateInput = z.infer<typeof contentUpdateInput>;

export const moveContentInput = z.object({
	status: z
		.enum(KANBAN_STATUSES)
		.describe("Coluna de destino: idea, draft, edited ou published"),
	index: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Posição na coluna, começando em 0. Sem ela, vai para o fim"),
});
export type MoveContentInput = z.infer<typeof moveContentInput>;

export const MAX_CALENDAR_DAYS = 92;

export const calendarRangeInput = z
	.object({ from: isoDate, to: isoDate })
	.refine(({ from, to }) => from <= to, {
		message: "A data inicial precisa vir antes da final.",
	})
	.refine(
		({ from, to }) =>
			(Date.parse(to) - Date.parse(from)) / 86_400_000 < MAX_CALENDAR_DAYS,
		{ message: `Escolha um intervalo de até ${MAX_CALENDAR_DAYS} dias.` },
	);
export type CalendarRange = z.infer<typeof calendarRangeInput>;

export const plannedDateInput = isoDate;
