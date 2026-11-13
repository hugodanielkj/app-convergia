import { z } from "zod";
import type { Content } from "../conteudo/content";
export const brainstormInput = z.object({
	brief: z
		.string()
		.trim()
		.min(1)
		.max(5000)
		.describe("Tema, público e objetivo das ideias"),
});
export const ideaDraftSchema = z.object({
	title: z.string().trim().min(1).max(200),
	text: z.string().trim().min(1).max(5000),
	reason: z.string().trim().min(1).max(2000),
});
export type IdeaDraft = z.infer<typeof ideaDraftSchema>;
export type Idea = IdeaDraft &
	Pick<
		Content,
		| "id"
		| "companyId"
		| "createdByUserId"
		| "createdByKind"
		| "contentVersion"
		| "approvalStatus"
		| "currentApprovalRequestId"
		| "createdAt"
		| "updatedAt"
	> & { state: "active" | "added" | "dismissed"; contentId: string | null };
/** Projeção somente de leitura para a tela e o fluxo comum de aprovação (RN-201). Não cria card. */
export function ideaApprovalSubject(idea: Idea): Content {
	return {
		...idea,
		approvalItemType: "idea",
		idea: idea.text,
		script: {
			hook: idea.title,
			body: idea.text,
			cta: null,
			caption: idea.reason,
		},
		citations: [],
		platform: "instagram",
		mediaType: null,
		format: null,
		category: null,
		funnelStage: null,
		targetDurationSeconds: null,
		status: "idea",
		position: 0,
		plannedDate: null,
		deletedAt: null,
	};
}
