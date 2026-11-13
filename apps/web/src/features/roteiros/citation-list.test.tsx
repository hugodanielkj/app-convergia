import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CitationList } from "./citation-list";

describe("lista de citações (RN-075)", () => {
	it("abre cada página da web em outra aba, com o domínio à vista", () => {
		render(
			<CitationList
				citations={[
					{ title: "Guia de sofás", url: "https://www.example.com/guia" },
					{ title: "Pesquisa", url: "http://dados.example.org/p" },
				]}
			/>,
		);
		const links = screen.getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"https://www.example.com/guia",
			"http://dados.example.org/p",
		]);
		expect(links[0]).toHaveTextContent("Guia de sofásexample.com");
	});

	it("não vira link um endereço que não é da web", () => {
		render(
			<CitationList
				citations={[{ title: "Estranha", url: "javascript:alert(1)" }]}
			/>,
		);
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getByText("Estranha")).toBeInTheDocument();
	});
});
