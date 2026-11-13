import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInRouter } from "../../test/render-in-router";
import { Home } from "./home";

describe("tela Início", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ contents: [] })),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("RN-006: mostra os atalhos principais", async () => {
		renderInRouter(<Home companyId="c1" />);

		expect(
			await screen.findByRole("heading", { name: "O que vamos fazer hoje?" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Criar roteiro/ })).toHaveAttribute(
			"href",
			"/empresas/c1/roteiros/novo",
		);
		expect(screen.getByText("Ideias para a semana")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Aprovações pendentes/ }),
		).toHaveAttribute("href", "/empresas/c1/aprovacoes");
	});

	it("tem estado vazio para os próximos posts", async () => {
		renderInRouter(<Home companyId="c1" />);

		expect(
			await screen.findByText("Nenhum post nos próximos 7 dias"),
		).toBeInTheDocument();
	});
});
