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
const contentApi = companyApi.contents[":contentId"];

type KanbanStatus = "idea" | "draft" | "edited" | "published";
type ContentParams = { companyId: string; contentId: string };
export type ScriptField = "hook" | "body" | "cta" | "caption";

export const api = {
	me: () => call(client.me.$get()),
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
	refineChat: (param: ContentParams) => call(contentApi.refine.$get({ param })),
	refine: (param: ContentParams, message: string) =>
		call(contentApi.refine.$post({ param, json: { message } })),
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
export type RefineMessageDto = Awaited<
	ReturnType<typeof api.refineChat>
>["messages"][number];
