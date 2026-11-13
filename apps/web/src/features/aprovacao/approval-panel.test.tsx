import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentDto } from "../../api/client";
import { fetchCall } from "../../test/fetch-call";
import { renderInRouter } from "../../test/render-in-router";
import { ApprovalPanel } from "./approval-panel";
import { approvalItem } from "./test-data";

const history = [
	{
		id: "e1",
		requestId: "req-1",
		contentId: "card-1",
		type: "submitted",
		actorId: "u1",
		actorKind: "agency",
		actorName: "Ana",
		itemVersion: 2,
		reason: null,
		at: "2026-11-13T15:00:00.000Z",
	},
	{
		id: "e2",
		requestId: "req-1",
		contentId: "card-1",
		type: "updated_while_pending",
		actorId: "u1",
		actorKind: "agency",
		actorName: "Ana",
		itemVersion: 3,
		reason: null,
		at: "2026-11-13T15:30:00.000Z",
	},
];

describe("aprovação no card", () => {
	let calls: { method: string; url: string; body: unknown }[];

	beforeEach(() => {
		calls = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const call = fetchCall(input, init);
				calls.push(call);
				const item = approvalItem({ request: { submittedVersion: 2 } });
				return Response.json(
					call.method === "GET"
						? { ...item, changedSinceSubmit: true, history }
						: item,
				);
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const card = (overrides: Partial<ContentDto> = {}) =>
		approvalItem({ content: overrides }).content;

	it("RN-204: roteiro só do cliente não mostra aprovação", () => {
		renderInRouter(
			<ApprovalPanel
				content={card({ approvalStatus: "none" })}
				isAgency
				unsavedChanges={false}
			/>,
		);
		expect(screen.queryByRole("heading", { name: "Aprovação" })).toBeNull();
	});

	it("RN-210: a agência envia o roteiro em preparo, depois de salvar", async () => {
		renderInRouter(
			<ApprovalPanel
				content={card({ approvalStatus: "in_preparation" })}
				isAgency
				unsavedChanges
			/>,
		);
		const send = await screen.findByRole("button", {
			name: "Enviar para aprovação",
		});
		expect(send).toBeDisabled();
		expect(
			screen.getByText("Salve as mudanças antes de enviar."),
		).toBeVisible();
	});

	it("RN-216: o cliente vê que a agência atualizou o roteiro e aprova a versão atual", async () => {
		renderInRouter(
			<ApprovalPanel
				content={card()}
				isAgency={false}
				unsavedChanges={false}
			/>,
		);

		expect(
			await screen.findByText(/A agência atualizou o roteiro depois de enviar/),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));

		expect(calls).toContainEqual({
			method: "POST",
			url: "/api/app/companies/c1/contents/card-1/approval/approve",
			body: { version: 3 },
		});
	});

	it("RN-230: mostra o histórico, do mais novo para o mais antigo", async () => {
		renderInRouter(
			<ApprovalPanel content={card()} isAgency unsavedChanges={false} />,
		);

		await userEvent.click(
			await screen.findByRole("button", { name: "Histórico" }),
		);

		const items = await screen.findAllByRole("listitem");
		expect(items[0]).toHaveTextContent(
			"Roteiro atualizado pela agência durante a aprovação",
		);
		expect(items[1]).toHaveTextContent("Enviado para aprovação");
		expect(items[1]).toHaveTextContent("Ana · versão 2");
	});
});
