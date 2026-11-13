import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { renderInRouter } from "../../test/render-in-router";
import { ReferencesPage } from "./references-page";

afterEach(() => vi.unstubAllGlobals());
const reference = {
	id: "r1",
	companyId: "c1",
	url: "https://www.instagram.com/criador/",
	kind: "creator",
	status: "ready",
	summary: "Resumo do conteúdo",
	text: "Dicas de decoração",
	analysis: null,
	error: null,
	analysisStatus: "none",
};
describe("Referências no celular", () => {
	it("salva a URL e mostra o processamento em segundo plano", async () => {
		let saved = false;
		const calls: unknown[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				if (call.method === "POST") {
					saved = true;
					return Response.json({
						reference: { ...reference, status: "queued" },
					});
				}
				return Response.json({
					references: saved ? [{ ...reference, status: "queued" }] : [],
				});
			}),
		);
		renderInRouter(<ReferencesPage companyId="c1" />);
		expect(
			await screen.findByText("Nenhuma referência salva"),
		).toBeInTheDocument();
		await userEvent.type(
			screen.getByLabelText("Link público do Instagram"),
			reference.url,
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Salvar referência" }),
		);
		expect(await screen.findByText("Processando...")).toBeInTheDocument();
		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/references",
			body: { url: reference.url },
		});
	});
	it("mostra texto e resumo e pede análise de criador", async () => {
		const calls: unknown[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				return Response.json(
					call.method === "GET"
						? { references: [reference] }
						: { reference, analysis: null },
				);
			}),
		);
		renderInRouter(<ReferencesPage companyId="c1" />);
		expect(await screen.findByText("Resumo do conteúdo")).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Analisar criador" }),
		);
		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/references/r1/analysis",
			body: undefined,
		});
	});
	it("mostra mensagem do limite de criador devolvida pela API", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
				fetchCall(input, init).method === "GET"
					? Response.json({ references: [] })
					: Response.json(
							{
								error: "creator_limit",
								message:
									"Esta empresa já tem 1 criador de referência. Exclua o atual antes de salvar outro.",
							},
							{ status: 409 },
						),
			),
		);
		renderInRouter(<ReferencesPage companyId="c1" />);
		await userEvent.type(
			await screen.findByLabelText("Link público do Instagram"),
			reference.url,
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Salvar referência" }),
		);
		expect(await screen.findByRole("alert")).toHaveTextContent("1 criador");
	});
});
