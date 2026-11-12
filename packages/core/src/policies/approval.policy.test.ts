import { describe, expect, it } from "vitest";
import { agency, client } from "../conteudo/testing/actors";
import { NotDecidedYet } from "../shared/domain-error";
import {
	assertCanEditContent,
	initialApprovalStatus,
	onContentChanged,
} from "./approval.policy";

describe("política de aprovação", () => {
	it("RN-204: o cliente cria sem aprovação", () => {
		expect(initialApprovalStatus(client)).toBe("none");
	});

	it("RN-203: a agência cria em preparo", () => {
		expect(initialApprovalStatus(agency)).toBe("in_preparation");
	});

	it("RN-203: mexida da agência em conteúdo do cliente leva para em preparo", () => {
		expect(onContentChanged(agency, "none")).toEqual({
			approvalStatus: "in_preparation",
			event: null,
		});
	});

	it("RN-213: a agência ajusta um item recusado e ele volta para em preparo", () => {
		expect(onContentChanged(agency, "rejected").approvalStatus).toBe(
			"in_preparation",
		);
	});

	it("RN-215: a agência mexe em item aprovado e ele perde a aprovação", () => {
		expect(onContentChanged(agency, "approved")).toEqual({
			approvalStatus: "in_preparation",
			event: "approval_lost",
		});
	});

	it("RN-216: a agência edita item pendente e a pendência continua", () => {
		expect(onContentChanged(agency, "pending")).toEqual({
			approvalStatus: "pending",
			event: "updated_while_pending",
		});
	});

	it("RN-204: o cliente edita o que é só dele sem mudar a aprovação", () => {
		expect(() => assertCanEditContent(client, "none")).not.toThrow();
		expect(onContentChanged(client, "none").approvalStatus).toBe("none");
	});

	it("RN-217: o cliente não edita item enviado pela agência", () => {
		expect(() => assertCanEditContent(client, "pending")).toThrow(
			"Este item foi enviado pela agência. Aprove ou recuse com um comentário.",
		);
	});

	it("Q-26: o cliente editar roteiro mexido pela agência está em aberto", () => {
		for (const status of ["in_preparation", "approved", "rejected"] as const) {
			expect(() => assertCanEditContent(client, status)).toThrow(NotDecidedYet);
		}
	});

	it("RN-203: a agência sempre pode mexer no conteúdo", () => {
		for (const status of [
			"none",
			"in_preparation",
			"pending",
			"approved",
			"rejected",
		] as const) {
			expect(() => assertCanEditContent(agency, status)).not.toThrow();
		}
	});
});
