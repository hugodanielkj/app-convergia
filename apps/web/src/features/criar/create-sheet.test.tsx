import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CREATE_OPTIONS, CreateSheet } from "./create-sheet";

describe("menu Criar", () => {
	it("mostra as opções de criação, ainda marcadas como em breve", () => {
		render(<CreateSheet open onClose={() => {}} />);

		const dialog = screen.getByRole("dialog", { name: "Criar" });
		expect(dialog).toBeInTheDocument();
		for (const option of CREATE_OPTIONS) {
			expect(
				screen.getByRole("button", { name: new RegExp(option.label) }),
			).toBeDisabled();
		}
	});

	it("fecha com Esc e pelo botão Fechar", async () => {
		const onClose = vi.fn();
		render(<CreateSheet open onClose={onClose} />);

		await userEvent.keyboard("{Escape}");
		await userEvent.click(
			screen.getAllByRole("button", { name: "Fechar" })[1] as HTMLElement,
		);

		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("não renderiza nada fechado", () => {
		render(<CreateSheet open={false} onClose={() => {}} />);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
