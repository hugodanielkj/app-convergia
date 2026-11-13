import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalItemDto } from "../../api/client";
import { fetchCall } from "../../test/fetch-call";
import { renderInRouter } from "../../test/render-in-router";
import { ApprovalsPage } from "./approvals-page";
import { approvalItem } from "./test-data";

describe("tela Aprovações", () => {
	let calls: { method: string; url: string; body: unknown }[];
	let lists: Record<string, ApprovalItemDto[]>;
	let decision: Response | null;

	beforeEach(() => {
		calls = [];
		lists = { pending: [approvalItem()] };
		decision = null;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				if (call.method === "GET") {
					const view =
						new URL(String(input), "http://localhost").searchParams.get(
							"view",
						) ?? "pending";
					return Response.json({ items: lists[view] ?? [] });
				}
				return decision ?? Response.json(approvalItem());
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("RN-211: o cliente vê o roteiro e aprova a versão que está na tela", async () => {
		renderInRouter(<ApprovalsPage companyId="c1" isAgency={false} />);

		expect(await screen.findByText("Gancho da agência")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));

		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/contents/card-1/approval/approve",
			body: { version: 3 },
		});
	});

	it("RN-212: o cliente recusa com motivo opcional", async () => {
		renderInRouter(<ApprovalsPage companyId="c1" isAgency={false} />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Recusar" }),
		);
		const sheet = screen.getByRole("dialog", { name: "Recusar roteiro" });
		await userEvent.type(
			within(sheet).getByLabelText(/O que a agência precisa mudar/),
			"Gancho fraco",
		);
		await userEvent.click(
			within(sheet).getByRole("button", { name: "Recusar" }),
		);

		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/contents/card-1/approval/reject",
			body: { version: 3, reason: "Gancho fraco" },
		});
	});

	it("RN-216: mostra a mensagem do servidor quando a agência mudou o roteiro", async () => {
		decision = Response.json(
			{
				error: "approval_version_changed",
				message: "O item foi atualizado pela agência. Revise a versão nova.",
			},
			{ status: 409 },
		);
		renderInRouter(<ApprovalsPage companyId="c1" isAgency={false} />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Aprovar" }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"O item foi atualizado pela agência. Revise a versão nova.",
		);
	});

	it("o cliente sem pendências vê o estado vazio", async () => {
		lists = {};
		renderInRouter(<ApprovalsPage companyId="c1" isAgency={false} />);

		expect(
			await screen.findByText(/Quando a agência enviar um item/),
		).toBeInTheDocument();
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
	});

	it("RN-214: a agência aprova em nome do cliente só com motivo", async () => {
		renderInRouter(<ApprovalsPage companyId="c1" isAgency />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Aprovar em nome do cliente" }),
		);
		const sheet = screen.getByRole("dialog", {
			name: "Aprovar em nome do cliente",
		});
		const confirm = within(sheet).getByRole("button", {
			name: "Aprovar em nome do cliente",
		});
		expect(confirm).toBeDisabled();
		await userEvent.type(
			within(sheet).getByLabelText("Como o cliente aprovou?"),
			"Aprovou por WhatsApp",
		);
		await userEvent.click(confirm);

		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/contents/card-1/approval/approve",
			body: { version: 3, onBehalfReason: "Aprovou por WhatsApp" },
		});
		// A agência não recusa (RN-214).
		expect(screen.queryByRole("button", { name: "Recusar" })).toBeNull();
	});

	it("RN-210, RN-218: a agência envia o que está em preparo e cancela o envio", async () => {
		lists.to_submit = [
			approvalItem({
				content: { id: "card-2", approvalStatus: "in_preparation" },
				request: null,
			}),
		];
		renderInRouter(<ApprovalsPage companyId="c1" isAgency />);

		await userEvent.click(
			await screen.findByRole("button", { name: "Cancelar envio" }),
		);
		await userEvent.click(screen.getByRole("tab", { name: "Para enviar" }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Enviar para aprovação" }),
		);

		expect(calls.filter((c) => c.method === "POST").map((c) => c.url)).toEqual([
			"/api/app/companies/c1/contents/card-1/approval/cancel",
			"/api/app/companies/c1/contents/card-2/approval/submit",
		]);
	});

	it("RN-212: a agência vê o motivo da recusa", async () => {
		lists.rejected = [
			approvalItem({
				content: { approvalStatus: "rejected" },
				request: {
					status: "rejected",
					reason: "Muito longo",
					decidedAt: "2026-11-13T16:00:00.000Z",
				},
			}),
		];
		renderInRouter(<ApprovalsPage companyId="c1" isAgency />);

		await userEvent.click(
			await screen.findByRole("tab", { name: "Recusados" }),
		);

		expect(await screen.findByText("“Muito longo”")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Revisar conteúdo" }),
		).toHaveAttribute("href", "/empresas/c1/cards/card-1");
	});
});
