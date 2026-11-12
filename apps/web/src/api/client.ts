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

export const api = {
	me: () => call(client.me.$get()),
	companies: () => call(client.companies.$get()),
	company: (companyId: string) =>
		call(client.companies[":companyId"].$get({ param: { companyId } })),
};

export type Me = Awaited<ReturnType<typeof api.me>>;
export type CompanySummary = Awaited<ReturnType<typeof api.company>>;
