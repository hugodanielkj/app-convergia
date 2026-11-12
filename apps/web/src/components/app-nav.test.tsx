import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderInRouter } from "../test/render-in-router";
import { BottomNav } from "./app-nav";

describe("navegação inferior", () => {
	it("RN-005: tem Início, Calendário, Criar, Aprovações e Mais, nessa ordem", async () => {
		renderInRouter(<BottomNav companyId="c1" onCreate={() => {}} />);

		const nav = await screen.findByRole("navigation", {
			name: "Navegação principal",
		});
		const names = Array.from(nav.querySelectorAll("a, button")).map(
			(el) => el.textContent || el.getAttribute("aria-label"),
		);
		expect(names).toEqual([
			"Início",
			"Calendário",
			"Criar",
			"Aprovações",
			"Mais",
		]);
	});

	it("RN-022: os links levam a empresa da URL", async () => {
		renderInRouter(<BottomNav companyId="c1" onCreate={() => {}} />);

		expect(
			await screen.findByRole("link", { name: "Calendário" }),
		).toHaveAttribute("href", "/empresas/c1/calendario");
	});

	it("marca a tela atual", async () => {
		renderInRouter(
			<BottomNav companyId="c1" onCreate={() => {}} />,
			"/empresas/c1/aprovacoes",
		);

		expect(
			await screen.findByRole("link", { name: "Aprovações" }),
		).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute(
			"aria-current",
		);
	});

	it("o botão Criar abre o menu de criação", async () => {
		const onCreate = vi.fn();
		renderInRouter(<BottomNav companyId="c1" onCreate={onCreate} />);

		await userEvent.click(await screen.findByRole("button", { name: "Criar" }));

		expect(onCreate).toHaveBeenCalledOnce();
	});
});
