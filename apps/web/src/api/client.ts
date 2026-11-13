import type { AppApi } from "@convergia/server/app-api";
import { type ClientResponse, hc } from "hono/client";
import { getDevApiKey } from "../lib/dev-session";

export const UNEXPECTED_ERROR =
	"Ocorreu um erro inesperado. Tente de novo em instantes.";

/** Mensagem para mostrar ao usuário a partir de qualquer erro. */
export function errorMessage(error: unknown): string {
	return error instanceof ApiError ? error.message : UNEXPECTED_ERROR;
}

/** Erro devolvido pela API do app. `message` é a mensagem para o usuário (regra de negócio §7). */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

const client = hc<AppApi>("/api/app", {
	headers: (): Record<string, string> => {
		const key = getDevApiKey();
		return key ? { authorization: `Bearer ${key}` } : {};
	},
});

async function call<T>(request: Promise<ClientResponse<T>>): Promise<T> {
	let response: ClientResponse<T>;
	try {
		response = await request;
	} catch {
		throw new ApiError(
			0,
			"offline",
			"Sem conexão. Confira a internet e tente de novo.",
		);
	}
	if (response.ok) {
		return response.json() as Promise<T>;
	}
	const body = (await response.json().catch(() => ({}))) as {
		error?: string;
		message?: string;
	};
	throw new ApiError(
		response.status,
		body.error ?? "unexpected",
		body.message ?? UNEXPECTED_ERROR,
	);
}

const companyApi = client.companies[":companyId"];
const searchesApi = companyApi.videos.searches;
const contentApi = companyApi.contents[":contentId"];
const approvalApi = contentApi.approval;
const ideasApi = companyApi.ideas;

type KanbanStatus = "idea" | "draft" | "edited" | "published";
type ContentParams = { companyId: string; contentId: string };
export type ScriptField = "hook" | "body" | "cta" | "caption";
export type ApprovalView = "pending" | "to_submit" | "rejected" | "approved";
export type VideoSort = "relevance" | "popularity" | "recent";

export const api = {
	me: () => call(client.me.$get()),
	references: (companyId: string) =>
		call(companyApi.references.$get({ param: { companyId } })),
	saveReference: (companyId: string, url: string) =>
		call(companyApi.references.$post({ param: { companyId }, json: { url } })),
	deleteReference: (companyId: string, referenceId: string) =>
		call(
			companyApi.references[":referenceId"].$delete({
				param: { companyId, referenceId },
			}),
		),
	creatorAnalysis: (companyId: string, referenceId: string) =>
		call(
			companyApi.references[":referenceId"].analysis.$post({
				param: { companyId, referenceId },
			}),
		),
	contentReferences: (param: ContentParams) =>
		call(contentApi.references.$get({ param })),
	attachReference: (
		param: ContentParams,
		json: Parameters<typeof contentApi.references.$post>[0]["json"],
	) => call(contentApi.references.$post({ param, json })),
	detachReference: (param: ContentParams, referenceId: string) =>
		call(
			contentApi.references[":referenceId"].$delete({
				param: { ...param, referenceId },
			}),
		),
	contentSources: (param: ContentParams) =>
		call(contentApi.sources.$get({ param })),
	addSource: (
		param: ContentParams,
		json: Parameters<typeof contentApi.sources.$post>[0]["json"],
	) => call(contentApi.sources.$post({ param, json })),
	ideas: (companyId: string) => call(ideasApi.$get({ param: { companyId } })),
	regenerateIdeas: (companyId: string, brief: string) =>
		call(ideasApi.$post({ param: { companyId }, json: { brief } })),
	acceptIdea: (companyId: string, ideaId: string) =>
		call(ideasApi[":ideaId"].accept.$post({ param: { companyId, ideaId } })),
	dismissIdea: (companyId: string, ideaId: string) =>
		call(ideasApi[":ideaId"].$delete({ param: { companyId, ideaId } })),
	companies: () => call(client.companies.$get()),
	company: (companyId: string) =>
		call(companyApi.$get({ param: { companyId } })),

	contents: (companyId: string) =>
		call(companyApi.contents.$get({ param: { companyId }, query: {} })),
	calendar: (companyId: string, from: string, to: string) =>
		call(
			companyApi.calendar.$get({ param: { companyId }, query: { from, to } }),
		),
	trash: (companyId: string) =>
		call(companyApi.trash.$get({ param: { companyId } })),
	content: (param: ContentParams) => call(contentApi.$get({ param })),
	createContent: (
		companyId: string,
		json: Parameters<typeof companyApi.contents.$post>[0]["json"],
	) => call(companyApi.contents.$post({ param: { companyId }, json })),
	updateContent: (
		param: ContentParams,
		json: Parameters<typeof contentApi.$patch>[0]["json"],
	) => call(contentApi.$patch({ param, json })),
	moveContent: (param: ContentParams, status: KanbanStatus) =>
		call(contentApi.move.$post({ param, json: { status } })),
	scheduleContent: (param: ContentParams, plannedDate: string | null) =>
		call(contentApi.schedule.$put({ param, json: { plannedDate } })),
	duplicateContent: (param: ContentParams) =>
		call(contentApi.duplicate.$post({ param })),
	deleteContent: (param: ContentParams) => call(contentApi.$delete({ param })),
	restoreContent: (param: ContentParams) =>
		call(contentApi.restore.$post({ param })),

	approvals: (companyId: string, view: ApprovalView) =>
		call(companyApi.approvals.$get({ param: { companyId }, query: { view } })),
	approval: (param: ContentParams) => call(approvalApi.$get({ param })),
	submitApproval: (param: ContentParams) =>
		call(approvalApi.submit.$post({ param })),
	cancelApproval: (param: ContentParams) =>
		call(approvalApi.cancel.$post({ param })),
	approve: (
		param: ContentParams,
		json: Parameters<typeof approvalApi.approve.$post>[0]["json"],
	) => call(approvalApi.approve.$post({ param, json })),
	reject: (
		param: ContentParams,
		json: Parameters<typeof approvalApi.reject.$post>[0]["json"],
	) => call(approvalApi.reject.$post({ param, json })),

	generateScript: (param: ContentParams) =>
		call(contentApi.script.$post({ param })),
	scriptOptions: (param: ContentParams, field: ScriptField) =>
		call(
			contentApi.options[":field"].$post({
				param: { ...param, field },
				// O máximo da RN-071; o servidor valida.
				json: { count: 3 },
			}),
		),
	history: (param: ContentParams) => call(contentApi.history.$get({ param })),
	refineChat: (param: ContentParams) => call(contentApi.refine.$get({ param })),
	refine: (param: ContentParams, message: string, webSearch: boolean) =>
		call(contentApi.refine.$post({ param, json: { message, webSearch } })),
	discoverVideos: (
		companyId: string,
		json: Parameters<typeof searchesApi.$post>[0]["json"],
	) => call(searchesApi.$post({ param: { companyId }, json })),
	videoSearch: (companyId: string, requestId: string, sort: VideoSort) =>
		call(
			searchesApi[":requestId"].$get({
				param: { companyId, requestId },
				query: { sort },
			}),
		),
	reviewPreview: (
		param: ContentParams,
		messageId: string,
		decision: "apply" | "discard",
	) =>
		call(
			contentApi.refine[":messageId"][":decision"].$post({
				param: { ...param, messageId, decision },
			}),
		),
};

export type Me = Awaited<ReturnType<typeof api.me>>;
export type CompanySummary = Awaited<ReturnType<typeof api.company>>;
export type ContentDto = Awaited<ReturnType<typeof api.content>>;
export type ContentChanges = Parameters<typeof api.updateContent>[1];
export type HistoryEntryDto = Awaited<
	ReturnType<typeof api.history>
>["entries"][number];
export type CitationDto = ContentDto["citations"][number];
export type ApprovalItemDto = Awaited<
	ReturnType<typeof api.approvals>
>["items"][number];
export type ApprovalDetailDto = Awaited<ReturnType<typeof api.approval>>;
export type ApprovalEventDto = ApprovalDetailDto["history"][number];
export type RefineMessageDto = Awaited<
	ReturnType<typeof api.refineChat>
>["messages"][number];
export type VideoSearchDto = Awaited<ReturnType<typeof api.videoSearch>>;
export type DiscoveredVideoDto = VideoSearchDto["results"][number];
