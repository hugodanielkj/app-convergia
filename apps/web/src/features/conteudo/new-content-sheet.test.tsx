import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewContentSheet } from "./new-content-sheet";

describe("Novo card", () => {
	it("cria com o título e a data do dia escolhido", async () => {
		const onCreate = vi.fn();
		render(
			<NewContentSheet
				open
				plannedDate="2026-11-16"
				onClose={() => {}}
				onCreate={onCreate}
			/>,
		);

		expect(
			screen.getByText(/Planejado para Segunda-feira, 16 de nov/),
		).toBeInTheDocument();
		await userEvent.type(
			screen.getByLabelText("Sobre o que é o post?"),
			"  Bastidores  ",
		);
		await userEvent.click(screen.getByRole("button", { name: "Criar card" }));

		expect(onCreate).toHaveBeenCalledWith({
			title: "Bastidores",
			plannedDate: "2026-11-16",
		});
	});

	it("não deixa criar sem título", () => {
		render(<NewContentSheet open onClose={() => {}} onCreate={() => {}} />);

		expect(screen.getByRole("button", { name: "Criar card" })).toBeDisabled();
	});
});
