import { afterEach, describe, expect, it, vi } from "vitest";
import { setDevApiKey } from "../lib/dev-session";
import { ApiError, api } from "./client";

function respond(status: number, body: unknown) {
	return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
		Response.json(body, { status }),
	);
}

describe("cliente da API do app", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("envia a chave de desenvolvimento no cabeçalho", async () => {
		const fetchMock = respond(200, { companies: [] });
		vi.stubGlobal("fetch", fetchMock);
		setDevApiKey("ag_mcp_teste");

		await api.companies();

		const init = fetchMock.mock.calls[0]?.[1];
		expect(new Headers(init?.headers).get("authorization")).toBe(
			"Bearer ag_mcp_teste",
		);
	});

	it("RN-015: devolve a mensagem do servidor, sem reescrever", async () => {
		vi.stubGlobal(
			"fetch",
			respond(403, {
				error: "no_access",
				message: "Você não tem acesso a esta empresa.",
			}),
		);

		const error = await api.company("c2").catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			status: 403,
			code: "no_access",
			message: "Você não tem acesso a esta empresa.",
		});
	});

	it("sem conexão, avisa em português", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);

		await expect(api.me()).rejects.toThrow(
			"Sem conexão. Confira a internet e tente de novo.",
		);
	});
});
