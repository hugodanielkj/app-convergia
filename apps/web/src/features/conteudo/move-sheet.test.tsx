import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ContentDto } from "../../api/client";
import { MoveSheet } from "./move-sheet";

const content = { id: "c1", status: "draft" } as ContentDto;

describe("Mover para...", () => {
	it("RN-061: mostra as quatro colunas e marca a atual", () => {
		render(
			<MoveSheet content={content} onClose={() => {}} onMove={() => {}} />,
		);

		for (const label of ["Ideia", "Rascunho", "Editado", "Publicado"]) {
			expect(
				screen.getByRole("button", { name: new RegExp(label) }),
			).toBeInTheDocument();
		}
		expect(screen.getByRole("button", { name: /Rascunho/ })).toBeDisabled();
	});

	it("envia a coluna escolhida", async () => {
		const onMove = vi.fn();
		render(<MoveSheet content={content} onClose={() => {}} onMove={onMove} />);

		await userEvent.click(screen.getByRole("button", { name: /Publicado/ }));

		expect(onMove).toHaveBeenCalledWith("published");
	});

	it("mostra o erro do servidor, como veio", () => {
		render(
			<MoveSheet
				content={content}
				onClose={() => {}}
				onMove={() => {}}
				error="Este card só pode ir para publicado depois que o cliente aprovar o roteiro."
			/>,
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Este card só pode ir para publicado depois que o cliente aprovar o roteiro.",
		);
	});
});
