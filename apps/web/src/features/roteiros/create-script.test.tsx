import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { renderInRouter } from "../../test/render-in-router";
import { CreateScript } from "./create-script";

const card = {
	id: "card-1",
	companyId: "c1",
	title: "Sofá retrátil",
	script: { hook: null, body: null, cta: null, caption: null },
};
const written = {
	...card,
	script: {
		hook: "Você conhece o sofá que vira cama?",
		body: "Mostre os três modos.",
		cta: "Salve este post",
		caption: "Sofá retrátil ✨",
	},
};

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;

describe("fluxo Criar roteiro (RN-006)", () => {
	let route: Route;
	let calls: { method: string; url: string; body?: unknown }[];

	beforeEach(() => {
		calls = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				return route(call.url, init);
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("informa o tema, gera e mostra o roteiro salvo no card", async () => {
		route = (url) =>
			url.endsWith("/script")
				? Response.json(written)
				: Response.json(card, { status: 201 });
		renderInRouter(<CreateScript companyId="c1" />);

		const generate = await screen.findByRole("button", {
			name: /Gerar roteiro/,
		});
		expect(generate).toBeDisabled();
		await userEvent.type(
			screen.getByLabelText("Sobre o que é o post?"),
			"Sofá retrátil",
		);
		await userEvent.click(screen.getByRole("button", { name: "Carrossel" }));
		await userEvent.click(generate);

		expect(await screen.findByText("Revise o roteiro")).toBeInTheDocument();
		expect(
			screen.getByText("Você conhece o sofá que vira cama?"),
		).toBeInTheDocument();
		expect(calls.map((c) => [c.method, c.url])).toEqual([
			["POST", "/api/app/companies/c1/contents"],
			["POST", "/api/app/companies/c1/contents/card-1/script"],
		]);
		expect(calls[0]?.body).toEqual({
			title: "Sofá retrátil",
			idea: null,
			mediaType: "carousel",
		});
		expect(
			screen.getByRole("button", { name: "Refinar com a IA" }),
		).toBeInTheDocument();
	});

	it("mostra a mensagem do servidor e tenta de novo sem criar outro card", async () => {
		let fail = true;
		route = (url) => {
			if (!url.endsWith("/script")) return Response.json(card, { status: 201 });
			if (fail) {
				fail = false;
				return Response.json(
					{
						error: "quota_exhausted",
						message:
							"A cota diária de gerar roteiro desta empresa acabou (10 por dia). Tente amanhã.",
					},
					{ status: 429 },
				);
			}
			return Response.json(written);
		};
		renderInRouter(<CreateScript companyId="c1" />);

		await userEvent.type(
			await screen.findByLabelText("Sobre o que é o post?"),
			"Sofá",
		);
		await userEvent.click(
			screen.getByRole("button", { name: /Gerar roteiro/ }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"A cota diária de gerar roteiro desta empresa acabou (10 por dia). Tente amanhã.",
		);
		await userEvent.click(
			screen.getByRole("button", { name: /Tentar de novo/ }),
		);
		expect(await screen.findByText("Revise o roteiro")).toBeInTheDocument();
		expect(calls.filter((c) => c.url.endsWith("/contents"))).toHaveLength(1);
	});
});
