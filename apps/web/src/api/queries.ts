import { queryOptions } from "@tanstack/react-query";
import { type ApprovalView, api, type VideoSort } from "./client";

export const meQuery = queryOptions({ queryKey: ["me"], queryFn: api.me });

export const companiesQuery = queryOptions({
	queryKey: ["companies"],
	queryFn: api.companies,
});

export const companyQuery = (companyId: string) =>
	queryOptions({
		queryKey: ["companies", companyId],
		queryFn: () => api.company(companyId),
	});

/** Tudo o que depende dos cards de uma empresa fica sob esta chave, para invalidar junto. */
export const contentsKey = (companyId: string) => [
	"companies",
	companyId,
	"contents",
];

export const contentsQuery = (companyId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "all"],
		queryFn: () => api.contents(companyId),
	});

export const calendarQuery = (companyId: string, from: string, to: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "calendar", from, to],
		queryFn: () => api.calendar(companyId, from, to),
	});

export const trashQuery = (companyId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "trash"],
		queryFn: () => api.trash(companyId),
	});

export const contentQuery = (companyId: string, contentId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "one", contentId],
		queryFn: () => api.content({ companyId, contentId }),
	});

/** Listas da tela de aprovações. Ficam sob os cards: toda mudança num card as recarrega. */
export const approvalsQuery = (companyId: string, view: ApprovalView) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "approvals", view],
		queryFn: () => api.approvals(companyId, view),
	});

/** Estado da aprovação do roteiro de um card, com o histórico (RN-230). */
export const approvalQuery = (companyId: string, contentId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "one", contentId, "approval"],
		queryFn: () => api.approval({ companyId, contentId }),
	});

/** Conversa de refino do roteiro de um card (RN-006). */
export const refineChatQuery = (companyId: string, contentId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "one", contentId, "refine"],
		queryFn: () => api.refineChat({ companyId, contentId }),
	});

/** 📎 RN-072: histórico de gerações do card, das mais novas para as mais antigas. */
export const historyQuery = (companyId: string, contentId: string) =>
	queryOptions({
		queryKey: [...contentsKey(companyId), "one", contentId, "history"],
		queryFn: () => api.history({ companyId, contentId }),
	});

/** ✅ RN-119: andamento e resultados de uma pesquisa de vídeos. */
export const videoSearchQuery = (
	companyId: string,
	requestId: string,
	sort: VideoSort,
) =>
	queryOptions({
		queryKey: ["companies", companyId, "video-searches", requestId, sort],
		queryFn: () => api.videoSearch(companyId, requestId, sort),
		// A resposta da pesquisa já chega pronta; o andamento segue pelo refetchInterval da tela.
		staleTime: 10_000,
	});
