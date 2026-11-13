import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { RefineSheet } from "./refine-sheet";

const preview = {
	hook: "Gancho curto",
	body: "Corpo",
	cta: "Salve",
	caption: "Legenda",
};
type Source = { title: string; url: string };
const exchangeWith = (sources: Source[]) => [
	{
		id: "m1",
		role: "user",
		text: "Deixe o gancho mais curto",
		preview: null,
		sources: [],
		previewStatus: null,
	},
	{
		id: "m2",
		role: "assistant",
		text: "Encurtei o gancho.",
		preview,
		sources,
		previewStatus: "pending",
	},
];

function renderSheet() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<RefineSheet companyId="c1" contentId="card-1" open onClose={() => {}} />
		</QueryClientProvider>,
	);
}

describe("folha Refinar roteiro (RN-006, RN-073)", () => {
	let calls: { method: string; url: string; body: unknown }[];
	let chat: unknown[];
	let exchange: ReturnType<typeof exchangeWith>;

	beforeEach(() => {
		calls = [];
		chat = [];
		exchange = exchangeWith([]);
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const { method, url, body } = fetchCall(input, init);
				calls.push({ method, url, body });
				if (method === "GET") return Response.json({ messages: chat });
				if (url.endsWith("/refine")) {
					chat = exchange;
					return Response.json({ messages: exchange });
				}
				return Response.json({ content: {}, message: {} });
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("estado vazio com sugestões que preenchem o pedido", async () => {
		renderSheet();
		await userEvent.click(
			await screen.findByRole("button", { name: "Use um tom mais divertido" }),
		);
		expect(screen.getByLabelText("O que mudar no roteiro")).toHaveValue(
			"Use um tom mais divertido",
		);
	});

	it("envia o pedido, mostra a prévia e aplica no card", async () => {
		renderSheet();
		await userEvent.type(
			await screen.findByLabelText("O que mudar no roteiro"),
			"Deixe o gancho mais curto",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Enviar pedido" }),
		);

		expect(await screen.findByText("Encurtei o gancho.")).toBeInTheDocument();
		expect(screen.getByText("Gancho curto")).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Aplicar no card" }),
		);

		expect(calls).toContainEqual(
			expect.objectContaining({
				method: "POST",
				url: "/api/app/companies/c1/contents/card-1/refine",
				body: { message: "Deixe o gancho mais curto", webSearch: false },
			}),
		);
		expect(calls).toContainEqual(
			expect.objectContaining({
				method: "POST",
				url: "/api/app/companies/c1/contents/card-1/refine/m2/apply",
			}),
		);
	});

	it("RN-075: pede a pesquisa na web e mostra as fontes da prévia", async () => {
		const source = {
			title: "Tendências de sofás em 2026",
			url: "https://www.example.com/sofas",
		};
		exchange = exchangeWith([source]);
		renderSheet();
		const toggle = await screen.findByRole("button", {
			name: "Pesquisar na web",
		});
		expect(toggle).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-pressed", "true");

		await userEvent.type(
			screen.getByLabelText("O que mudar no roteiro"),
			"Use dados atuais",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Enviar pedido" }),
		);

		expect(calls).toContainEqual(
			expect.objectContaining({
				method: "POST",
				url: "/api/app/companies/c1/contents/card-1/refine",
				body: { message: "Use dados atuais", webSearch: true },
			}),
		);
		expect(await screen.findByText("Fontes da pesquisa")).toBeInTheDocument();
		const link = screen.getByRole("link", { name: /Tendências de sofás/ });
		expect(link).toHaveAttribute("href", source.url);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
		expect(link).toHaveTextContent("example.com");
	});

	it("mostra o erro de negócio com a mensagem do servidor", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
				fetchCall(input, init).method === "GET"
					? Response.json({ messages: [] })
					: Response.json(
							{
								error: "quota_exhausted",
								message:
									"A cota diária de refinar roteiro desta empresa acabou (30 por dia). Tente amanhã.",
							},
							{ status: 429 },
						),
			),
		);
		renderSheet();
		await userEvent.type(
			await screen.findByLabelText("O que mudar no roteiro"),
			"Outro pedido",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Enviar pedido" }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"A cota diária de refinar roteiro desta empresa acabou (30 por dia). Tente amanhã.",
		);
	});
});
