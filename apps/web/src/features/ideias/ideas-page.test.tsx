import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { renderInRouter } from "../../test/render-in-router";
import { IdeasPage } from "./ideas-page";

const idea = {
	id: "i1",
	title: "Bastidores",
	text: "Mostre a produção",
	reason: "Aproxima as pessoas",
	approvalStatus: "none",
};
afterEach(() => vi.unstubAllGlobals());
describe("Ideias na interface", () => {
	it("mostra vazio e gera a partir de briefing", async () => {
		let generated = false;
		const calls: unknown[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				if (call.method === "POST") generated = true;
				return Response.json({ ideas: generated ? [idea] : [] });
			}),
		);
		renderInRouter(<IdeasPage companyId="c1" isAgency={false} />);
		expect(await screen.findByText("Nenhuma ideia ainda")).toBeInTheDocument();
		await userEvent.type(
			screen.getByLabelText("Tema, público e objetivo"),
			"Dicas de decoração",
		);
		await userEvent.click(screen.getByRole("button", { name: "Gerar ideias" }));
		expect(await screen.findByText("Bastidores")).toBeInTheDocument();
		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/ideas",
			body: { brief: "Dicas de decoração" },
		});
	});
	it("RN-083: ideia em preparo mostra justificativa e impede virar card", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({
					ideas: [{ ...idea, approvalStatus: "in_preparation" }],
				}),
			),
		);
		renderInRouter(<IdeasPage companyId="c1" isAgency />);
		expect(await screen.findByText(/Aproxima as pessoas/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Virar card" })).toBeDisabled();
		expect(screen.getByRole("link", { name: "Ver aprovação" })).toHaveAttribute(
			"href",
			"/empresas/c1/aprovacoes",
		);
	});
	it("RN-084: aprovada oferece conversão explícita e apresenta erro do servidor", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
				fetchCall(input, init).method === "GET"
					? Response.json({ ideas: [{ ...idea, approvalStatus: "approved" }] })
					: Response.json(
							{
								error: "idea_changed",
								message: "Esta ideia mudou. Atualize a lista e tente de novo.",
							},
							{ status: 409 },
						),
			),
		);
		renderInRouter(<IdeasPage companyId="c1" isAgency={false} />);
		await userEvent.click(
			await screen.findByRole("button", { name: "Virar card" }),
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Esta ideia mudou.",
		);
	});
	it("mostra erro de carregamento", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ error: "offline", message: "Falha ao carregar ideias" },
					{ status: 503 },
				),
			),
		);
		renderInRouter(<IdeasPage companyId="c1" isAgency={false} />);
		expect(
			await screen.findByText("Falha ao carregar ideias"),
		).toBeInTheDocument();
	});
});
