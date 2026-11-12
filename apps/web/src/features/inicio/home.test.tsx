import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInRouter } from "../../test/render-in-router";
import { Home } from "./home";

describe("tela Início", () => {
	it("RN-006: mostra os atalhos principais", async () => {
		renderInRouter(<Home companyId="c1" />);

		expect(
			await screen.findByRole("heading", { name: "O que vamos fazer hoje?" }),
		).toBeInTheDocument();
		expect(screen.getByText("Criar roteiro")).toBeInTheDocument();
		expect(screen.getByText("Ideias para a semana")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Aprovações pendentes/ }),
		).toHaveAttribute("href", "/empresas/c1/aprovacoes");
	});

	it("tem estado vazio para os próximos posts", async () => {
		renderInRouter(<Home companyId="c1" />);

		expect(
			await screen.findByText("Nenhum post planejado ainda"),
		).toBeInTheDocument();
	});
});
