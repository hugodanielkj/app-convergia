import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CREATE_OPTIONS, CreateSheet } from "./create-sheet";

describe("menu Criar", () => {
	it("as opções que ainda não existem ficam marcadas como em breve", () => {
		render(
			<CreateSheet
				open
				onClose={() => {}}
				onNewContent={() => {}}
				onCreateScript={() => {}}
			/>,
		);

		const dialog = screen.getByRole("dialog", { name: "Criar" });
		expect(dialog).toBeInTheDocument();
		for (const option of CREATE_OPTIONS.filter((o) => !o.action)) {
			expect(
				screen.getByRole("button", { name: new RegExp(option.label) }),
			).toBeDisabled();
		}
	});

	it("fecha com Esc e pelo botão Fechar", async () => {
		const onClose = vi.fn();
		render(
			<CreateSheet
				open
				onClose={onClose}
				onNewContent={() => {}}
				onCreateScript={() => {}}
			/>,
		);

		await userEvent.keyboard("{Escape}");
		await userEvent.click(
			screen.getAllByRole("button", { name: "Fechar" })[1] as HTMLElement,
		);

		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("não renderiza nada fechado", () => {
		render(
			<CreateSheet
				open={false}
				onClose={() => {}}
				onNewContent={() => {}}
				onCreateScript={() => {}}
			/>,
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("Novo card fecha o menu e abre a criação do card", async () => {
		const onClose = vi.fn();
		const onNewContent = vi.fn();
		render(
			<CreateSheet
				open
				onClose={onClose}
				onNewContent={onNewContent}
				onCreateScript={() => {}}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: /Novo card/ }));

		expect(onClose).toHaveBeenCalledOnce();
		expect(onNewContent).toHaveBeenCalledOnce();
	});
});
