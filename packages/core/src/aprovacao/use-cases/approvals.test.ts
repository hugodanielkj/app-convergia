import { beforeEach, describe, expect, it } from "vitest";
import type { Content } from "../../conteudo/content";
import {
	agency,
	client,
	otherCompanyClient,
	readOnly,
} from "../../conteudo/testing/actors";
import { InMemoryContentRepository } from "../../conteudo/testing/in-memory-content-repository";
import { createContents } from "../../conteudo/use-cases/create-contents";
import { moveContent } from "../../conteudo/use-cases/organize-content";
import { writeScriptChange } from "../../conteudo/use-cases/script-change";
import { updateContent } from "../../conteudo/use-cases/update-content";
import { InMemoryApprovalRepository } from "../testing/in-memory-approval-repository";
import {
	type ApprovalDeps,
	approveItem,
	cancelApprovalRequest,
	getApprovalItem,
	listApprovalItems,
	rejectItem,
	submitForApproval,
} from "./approvals";

const VERSION_CHANGED =
	"O item foi atualizado pela agência. Revise a versão nova.";
const NOT_PENDING = "Este item não está aguardando aprovação.";

describe("aprovação do roteiro", () => {
	let contents: InMemoryContentRepository;
	let deps: ApprovalDeps;

	beforeEach(() => {
		contents = new InMemoryContentRepository();
		deps = {
			contents,
			approvals: new InMemoryApprovalRepository(contents),
			now: () => new Date("2026-11-13T12:00:00Z"),
		};
	});

	/** Card com roteiro escrito pela agência, em preparo. */
	const agencyScript = async (): Promise<Content> => {
		const [content] = await createContents(deps, agency, [
			{ title: "Post", script: { hook: "Gancho da agência" } },
		]);
		if (!content) throw new Error("card não criado");
		return content;
	};

	const submitted = async () => {
		const content = await agencyScript();
		return (await submitForApproval(deps, agency, content.id)).content;
	};

	const history = async (id: string) =>
		(await getApprovalItem(deps, agency, id)).history.map((e) => e.type);

	it("RN-210: a agência envia o roteiro em preparo e o cliente passa a vê-lo pendente", async () => {
		const content = await agencyScript();
		expect(content.approvalStatus).toBe("in_preparation");

		const { content: sent, request } = await submitForApproval(
			deps,
			agency,
			content.id,
		);

		expect(sent.approvalStatus).toBe("pending");
		expect(sent.currentApprovalRequestId).toBe(request?.id);
		expect(request).toMatchObject({
			status: "pending",
			submittedVersion: content.contentVersion,
			snapshot: { hook: "Gancho da agência" },
			submittedBy: agency.userId,
		});
		const pending = await listApprovalItems(deps, client, "pending");
		expect(pending.map((item) => item.content.id)).toEqual([content.id]);
		expect(await history(content.id)).toEqual(["submitted"]);
	});

	it("RN-200: o cliente não envia para aprovação", async () => {
		const [own] = await createContents(deps, client, [
			{ title: "Meu post", script: { hook: "Meu gancho" } },
		]);
		await expect(
			submitForApproval(deps, client, own?.id ?? ""),
		).rejects.toThrow("Itens criados por você não precisam de aprovação.");
	});

	it("RN-204: roteiro em que a agência não mexeu não vai para aprovação", async () => {
		const [own] = await createContents(deps, client, [
			{ title: "Meu post", script: { hook: "Meu gancho" } },
		]);
		await expect(
			submitForApproval(deps, agency, own?.id ?? ""),
		).rejects.toThrow("a agência ainda não mexeu nele");
	});

	it("não envia roteiro vazio nem envia duas vezes", async () => {
		const [empty] = await createContents(deps, agency, [{ title: "Vazio" }]);
		await expect(
			submitForApproval(deps, agency, empty?.id ?? ""),
		).rejects.toThrow("Escreva ou gere o roteiro antes de enviar");

		const sent = await submitted();
		await expect(submitForApproval(deps, agency, sent.id)).rejects.toThrow(
			"Este item já está aguardando aprovação.",
		);
	});

	it("RN-211: o cliente aprova a versão que viu", async () => {
		const sent = await submitted();

		const { content, request } = await approveItem(deps, client, sent.id, {
			version: sent.contentVersion,
		});

		expect(content.approvalStatus).toBe("approved");
		expect(request).toMatchObject({
			status: "approved",
			decidedBy: client.userId,
			decidedOnBehalf: false,
		});
		expect(await history(sent.id)).toEqual(["submitted", "approved"]);
		// RN-061: aprovado, o card pode ir para publicado.
		await expect(
			moveContent(deps, agency, sent.id, { status: "published" }),
		).resolves.toMatchObject({ status: "published" });
	});

	it("RN-214: a agência aprova em nome do cliente só com motivo", async () => {
		const sent = await submitted();
		await expect(
			approveItem(deps, agency, sent.id, { version: sent.contentVersion }),
		).rejects.toThrow("Informe o motivo da aprovação em nome do cliente");

		const { request } = await approveItem(deps, agency, sent.id, {
			version: sent.contentVersion,
			onBehalfReason: "Cliente aprovou por WhatsApp em 10/11",
		});

		expect(request).toMatchObject({
			status: "approved",
			decidedBy: agency.userId,
			decidedOnBehalf: true,
			reason: "Cliente aprovou por WhatsApp em 10/11",
		});
		const detail = await getApprovalItem(deps, client, sent.id);
		expect(detail.history.at(-1)).toMatchObject({
			type: "approved_on_behalf",
			actorKind: "agency",
			reason: "Cliente aprovou por WhatsApp em 10/11",
		});
	});

	it("RN-214: a agência não recusa", async () => {
		const sent = await submitted();
		await expect(
			rejectItem(deps, agency, sent.id, { version: sent.contentVersion }),
		).rejects.toThrow("Só o cliente pode recusar.");
	});

	it("RN-212, RN-213: o cliente recusa e a agência ajusta e envia de novo", async () => {
		const sent = await submitted();

		const { content, request } = await rejectItem(deps, client, sent.id, {
			version: sent.contentVersion,
			reason: "Gancho fraco",
		});
		expect(content.approvalStatus).toBe("rejected");
		expect(request).toMatchObject({
			status: "rejected",
			reason: "Gancho fraco",
		});
		expect(
			(await listApprovalItems(deps, agency, "rejected")).map(
				(item) => item.request?.reason,
			),
		).toEqual(["Gancho fraco"]);
		await expect(submitForApproval(deps, agency, sent.id)).rejects.toThrow(
			"Ajuste o roteiro recusado antes de enviar de novo.",
		);

		const adjusted = await updateContent(deps, agency, sent.id, {
			script: { hook: "Gancho melhor" },
		});
		expect(adjusted.approvalStatus).toBe("in_preparation");
		const resent = await submitForApproval(deps, agency, sent.id);
		expect(resent.request?.snapshot.hook).toBe("Gancho melhor");
		expect(resent.request?.id).not.toBe(request?.id);
	});

	it("a recusa sem motivo também vale (RN-212)", async () => {
		const sent = await submitted();
		const { request } = await rejectItem(deps, client, sent.id, {
			version: sent.contentVersion,
		});
		expect(request?.reason).toBeNull();
	});

	it("RN-216: a agência edita na pendência e o cliente decide sobre a versão nova", async () => {
		const sent = await submitted();

		const edited = await updateContent(deps, agency, sent.id, {
			script: { hook: "Gancho revisado" },
		});

		expect(edited.approvalStatus).toBe("pending");
		const detail = await getApprovalItem(deps, client, sent.id);
		expect(detail.changedSinceSubmit).toBe(true);
		expect(detail.request).toMatchObject({
			submittedVersion: sent.contentVersion,
			itemVersion: edited.contentVersion,
			snapshot: { hook: "Gancho revisado" },
		});
		expect(detail.history.map((e) => e.type)).toEqual([
			"submitted",
			"updated_while_pending",
		]);
		// O cliente tinha aberto a versão antiga.
		await expect(
			approveItem(deps, client, sent.id, { version: sent.contentVersion }),
		).rejects.toThrow(VERSION_CHANGED);
		await expect(
			rejectItem(deps, client, sent.id, { version: sent.contentVersion }),
		).rejects.toThrow(VERSION_CHANGED);
		await expect(
			approveItem(deps, client, sent.id, { version: edited.contentVersion }),
		).resolves.toMatchObject({ content: { approvalStatus: "approved" } });
	});

	it("RN-215: a agência mexe no roteiro aprovado e ele perde a aprovação", async () => {
		const sent = await submitted();
		await approveItem(deps, client, sent.id, { version: sent.contentVersion });

		const edited = await updateContent(deps, agency, sent.id, {
			script: { cta: "Novo CTA" },
		});

		expect(edited.approvalStatus).toBe("in_preparation");
		expect(await history(sent.id)).toEqual([
			"submitted",
			"approved",
			"approval_lost",
		]);
		// Mudar só o título não é mexida no roteiro (RN-203).
		const renamed = await updateContent(deps, agency, sent.id, {
			title: "Outro título",
		});
		expect(renamed.contentVersion).toBe(edited.contentVersion);
	});

	it("RN-217: o cliente não edita o roteiro pendente", async () => {
		const sent = await submitted();
		await expect(
			updateContent(deps, client, sent.id, { script: { hook: "Meu" } }),
		).rejects.toThrow(
			"Este item foi enviado pela agência. Aprove ou recuse com um comentário.",
		);
	});

	it("RN-218: só a agência cancela o envio, e o roteiro volta para em preparo", async () => {
		const sent = await submitted();
		await expect(cancelApprovalRequest(deps, client, sent.id)).rejects.toThrow(
			"Só a agência pode cancelar um envio para aprovação.",
		);

		const { content, request } = await cancelApprovalRequest(
			deps,
			agency,
			sent.id,
		);

		expect(content.approvalStatus).toBe("in_preparation");
		expect(request?.status).toBe("cancelled");
		expect(await listApprovalItems(deps, client, "pending")).toEqual([]);
		expect(
			(await listApprovalItems(deps, agency, "to_submit")).map(
				(item) => item.content.id,
			),
		).toEqual([sent.id]);
		expect(await history(sent.id)).toEqual(["submitted", "cancelled"]);
	});

	it("decidir sobre item que não está pendente é recusado", async () => {
		const content = await agencyScript();
		const version = { version: content.contentVersion };
		await expect(
			approveItem(deps, client, content.id, version),
		).rejects.toThrow(NOT_PENDING);
		await expect(rejectItem(deps, client, content.id, version)).rejects.toThrow(
			NOT_PENDING,
		);
		await expect(
			cancelApprovalRequest(deps, agency, content.id),
		).rejects.toThrow(NOT_PENDING);

		const sent = await submitForApproval(deps, agency, content.id);
		await approveItem(deps, client, content.id, version);
		await expect(
			approveItem(deps, client, content.id, version),
		).rejects.toThrow(NOT_PENDING);
		expect(sent.request).not.toBeNull();
	});

	it("RN-015: outra empresa não vê nem decide", async () => {
		const sent = await submitted();
		await expect(
			approveItem(deps, otherCompanyClient, sent.id, {
				version: sent.contentVersion,
			}),
		).rejects.toThrow("Card não encontrado.");
		await expect(
			getApprovalItem(deps, otherCompanyClient, sent.id),
		).rejects.toThrow("Card não encontrado.");
		expect(
			await listApprovalItems(deps, otherCompanyClient, "pending"),
		).toEqual([]);
	});

	it("RN-024: conexão só de leitura não decide", async () => {
		const sent = await submitted();
		await expect(
			approveItem(deps, readOnly, sent.id, { version: sent.contentVersion }),
		).rejects.toThrow("Esta conexão é só de leitura.");
	});

	it("design §9: a edição feita sobre uma leitura antiga não sobrescreve a decisão", async () => {
		const sent = await submitted();
		// A agência abriu o card pendente; o cliente aprovou antes de ela salvar.
		await approveItem(deps, client, sent.id, { version: sent.contentVersion });

		await expect(
			writeScriptChange(deps, agency, sent, { ...sent.script, hook: "Tarde" }),
		).rejects.toThrow("O card mudou enquanto você trabalhava nele.");
		const detail = await getApprovalItem(deps, agency, sent.id);
		expect(detail.content.approvalStatus).toBe("approved");
		expect(detail.content.script.hook).toBe("Gancho da agência");
	});
});
