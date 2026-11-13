import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { ScriptOptionsSheet } from "./script-options-sheet";

function renderSheet(onUse = vi.fn(), onClose = vi.fn()) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<ScriptOptionsSheet
				companyId="c1"
				contentId="card-1"
				field="hook"
				onClose={onClose}
				onUse={onUse}
			/>
		</QueryClientProvider>,
	);
	return { onUse, onClose };
}

describe("folha Opções de gancho (RN-071)", () => {
	let calls: { method: string; url: string; body: unknown }[];
	let reply: () => Response;

	beforeEach(() => {
		calls = [];
		reply = () =>
			Response.json({
				contentId: "card-1",
				field: "hook",
				options: ["Gancho A", "Gancho B", "Gancho C"],
			});
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push(fetchCall(input, init));
				return reply();
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("só gera quando a pessoa pede, e avisa que o card não muda sozinho", async () => {
		renderSheet();
		expect(
			screen.getByText(/O card só muda se você escolher uma opção e salvar/),
		).toBeTruthy();
		expect(calls).toHaveLength(0);

		await userEvent.click(screen.getByRole("button", { name: "Gerar opções" }));

		expect(await screen.findByText("Gancho B")).toBeTruthy();
		expect(calls).toEqual([
			{
				method: "POST",
				url: "/api/app/companies/c1/contents/card-1/options/hook",
				body: { count: 3 },
			},
		]);
	});

	it("usar uma opção entrega o texto ao card e fecha a folha", async () => {
		const { onUse, onClose } = renderSheet();
		await userEvent.click(screen.getByRole("button", { name: "Gerar opções" }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Usar a opção 2" }),
		);
		expect(onUse).toHaveBeenCalledWith("hook", "Gancho B");
		expect(onClose).toHaveBeenCalled();
	});

	it("mostra a mensagem do servidor quando a regra ainda está em aberto", async () => {
		reply = () =>
			Response.json(
				{
					error: "not_decided_yet",
					questionId: "Q-21",
					message:
						"Esta funcionalidade depende de uma regra ainda não definida (Q-21).",
				},
				{ status: 501 },
			);
		renderSheet();
		await userEvent.click(screen.getByRole("button", { name: "Gerar opções" }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Esta funcionalidade depende de uma regra ainda não definida (Q-21).",
		);
		expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
	});
});
