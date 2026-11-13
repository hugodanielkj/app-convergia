import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { HistorySheet } from "./history-sheet";

const base = { contentId: "card-1", createdByUserId: "u1" };
const entries = [
	{
		...base,
		id: "g2",
		kind: "options",
		field: "hook",
		options: ["Gancho A", "Gancho B"],
		createdByKind: "agency",
		createdAt: "2026-11-13T15:30:00.000Z",
	},
	{
		...base,
		id: "g1",
		kind: "script",
		script: {
			hook: "Gancho do roteiro",
			body: "Corpo",
			cta: "Salve",
			caption: null,
		},
		createdByKind: "client",
		createdAt: "2026-11-12T12:00:00.000Z",
	},
];

function renderSheet() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<HistorySheet companyId="c1" contentId="card-1" open onClose={() => {}} />
		</QueryClientProvider>,
	);
}

describe("folha Histórico de gerações (RN-072)", () => {
	let calls: string[];
	let reply: () => Response;

	beforeEach(() => {
		calls = [];
		reply = () => Response.json({ entries });
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push(fetchCall(input, init).url);
				return reply();
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("mostra as gerações na ordem do servidor, com quem gerou e quando", async () => {
		renderSheet();
		const titles = await screen.findAllByRole("heading", { level: 3 });
		expect(titles.map((title) => title.textContent)).toEqual([
			"Opções de gancho",
			"Roteiro completo",
		]);
		expect(screen.getByText("Gancho B")).toBeTruthy();
		expect(screen.getByText("Gancho do roteiro")).toBeTruthy();
		expect(screen.getByText(/Agência ·/)).toBeTruthy();
		expect(screen.getByText(/13 de nov\..*12:30/)).toBeTruthy();
		expect(calls).toEqual(["/api/app/companies/c1/contents/card-1/history"]);
	});

	it("estado vazio explica o que aparece aqui", async () => {
		reply = () => Response.json({ entries: [] });
		renderSheet();
		expect(await screen.findByText("Nenhuma geração ainda")).toBeTruthy();
	});

	it("mostra a mensagem do servidor quando a regra ainda está em aberto", async () => {
		reply = () =>
			Response.json(
				{
					error: "not_decided_yet",
					questionId: "Q-23",
					message:
						"Esta funcionalidade depende de uma regra ainda não definida (Q-23).",
				},
				{ status: 501 },
			);
		renderSheet();
		expect((await screen.findByRole("alert")).textContent).toContain(
			"Esta funcionalidade depende de uma regra ainda não definida (Q-23).",
		);
	});
});
