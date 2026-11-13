import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCall } from "../../test/fetch-call";
import { renderInRouter } from "../../test/render-in-router";
import { InstagramPanel } from "./instagram-panel";

const connected = {
	status: "connected",
	simulated: false,
	connection: {
		companyId: "c1",
		igUserId: "ig-1",
		username: "padariadoze",
		connectedByUserId: "u1",
		connectedAt: "2026-11-13T12:00:00.000Z",
		tokenExpiresAt: "2027-01-12T12:00:00.000Z",
		simulated: false,
		snapshot: {
			collectedAt: "2026-11-13T12:00:00.000Z",
			profile: {
				username: "padariadoze",
				name: "Padaria Doze",
				biography: "Pães de fermentação natural",
				website: null,
				accountType: "business",
				followersCount: 1200,
				followsCount: 300,
				mediaCount: 80,
				profilePictureUrl: null,
			},
			posts: [
				{
					id: "p1",
					caption: "Post fraco",
					mediaType: "image",
					permalink: null,
					publishedAt: null,
					likeCount: 2,
					commentsCount: 0,
				},
				{
					id: "p2",
					caption: "Fornada de sexta",
					mediaType: "video",
					permalink: null,
					publishedAt: null,
					likeCount: 140,
					commentsCount: 12,
				},
			],
		},
	},
};

describe("Instagram na tela Desempenho", () => {
	let state: unknown;
	let calls: { method: string; url: string; body: unknown }[];
	let connectReply: Response | null;
	const assign = vi.fn();

	beforeEach(() => {
		state = { status: "not_connected", simulated: false, connection: null };
		calls = [];
		connectReply = null;
		assign.mockReset();
		vi.stubGlobal("location", { ...window.location, assign });
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				if (call.method === "GET") return Response.json(state);
				return (
					connectReply ??
					Response.json({
						authorizeUrl: "https://www.instagram.com/oauth/authorize?state=s",
					})
				);
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("RN-035: o cliente informa o @ e vai para a autenticação da Meta", async () => {
		renderInRouter(<InstagramPanel companyId="c1" isAgency={false} />);

		await userEvent.type(
			await screen.findByLabelText("@ da empresa no Instagram"),
			"padariadoze",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Conectar com o Instagram" }),
		);

		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/instagram/connect",
			body: { username: "padariadoze" },
		});
		expect(assign).toHaveBeenCalledWith(
			"https://www.instagram.com/oauth/authorize?state=s",
		);
	});

	it("mostra o erro do servidor, como veio", async () => {
		connectReply = Response.json(
			{ error: "invalid_input", message: "Confira os dados enviados." },
			{ status: 422 },
		);
		renderInRouter(<InstagramPanel companyId="c1" isAgency={false} />);

		await userEvent.type(
			await screen.findByLabelText("@ da empresa no Instagram"),
			"x",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Conectar com o Instagram" }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Confira os dados enviados.",
		);
		expect(assign).not.toHaveBeenCalled();
	});

	it("RN-034: a agência vê o aviso, sem botão de conectar", async () => {
		renderInRouter(<InstagramPanel companyId="c1" isAgency />);

		expect(
			await screen.findByText(/O cliente ainda não conectou o Instagram/),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Conectar com o Instagram" }),
		).toBeNull();
	});

	it("RN-039: conectado, mostra o perfil, o que a IA usa e os posts que mais engajaram", async () => {
		state = connected;
		renderInRouter(<InstagramPanel companyId="c1" isAgency={false} />);

		expect(
			await screen.findByRole("link", { name: /@padariadoze/ }),
		).toHaveAttribute("href", "https://www.instagram.com/padariadoze/");
		expect(screen.getByText("Pães de fermentação natural")).toBeInTheDocument();
		expect(
			screen.getByText(/1\.200 seguidores · 80 posts/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/legendas de 2 posts recentes/),
		).toBeInTheDocument();
		const posts = screen.getAllByRole("listitem");
		expect(posts[0]).toHaveTextContent("Fornada de sexta");
		expect(screen.getByRole("button", { name: "Reconectar" })).toBeVisible();
	});

	it("avisa quando o Instagram é simulado ou não está configurado", async () => {
		state = { status: "not_connected", simulated: true, connection: null };
		const { unmount } = renderInRouter(
			<InstagramPanel companyId="c1" isAgency={false} />,
		);
		expect(await screen.findByText("Simulado")).toBeInTheDocument();
		expect(
			screen.getByText(/Instagram simulado, com dados de exemplo/),
		).toBeVisible();
		unmount();

		state = { status: "not_configured", simulated: false, connection: null };
		renderInRouter(<InstagramPanel companyId="c1" isAgency={false} />);
		expect(
			await screen.findByText(/ainda não foi configurada neste ambiente/),
		).toBeInTheDocument();
	});
});
