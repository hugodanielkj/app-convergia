import { describe, expect, it } from "vitest";
import {
	agencyMember,
	clientOfA,
	companyA,
	companyB,
	otherAgencyCompany,
} from "../acesso/testing/fixtures";
import { InMemoryCompanyRepository } from "../acesso/testing/in-memory-company-repository";
import { resolveActorContext } from "./permission.policy";

const companies = new InMemoryCompanyRepository([
	companyA,
	companyB,
	otherAgencyCompany,
]);

const NO_ACCESS = "Você não tem acesso a esta empresa.";

describe("resolveActorContext", () => {
	it("RN-021: o usuário do cliente opera na própria empresa sem informá-la", async () => {
		expect(
			await resolveActorContext({ companies }, clientOfA, undefined),
		).toEqual({
			userId: clientOfA.userId,
			kind: "client_user",
			agencyId: "agency-1",
			companyId: companyA.id,
			scopes: ["read", "write"],
		});
	});

	it("RN-021: o usuário do cliente pode informar a própria empresa", async () => {
		const actor = await resolveActorContext(
			{ companies },
			clientOfA,
			companyA.id,
		);

		expect(actor.companyId).toBe(companyA.id);
	});

	it("RN-015: o usuário do cliente não opera em outra empresa", async () => {
		await expect(
			resolveActorContext({ companies }, clientOfA, companyB.id),
		).rejects.toThrow(NO_ACCESS);
	});

	it("RN-022: o membro da agência opera na empresa informada na chamada", async () => {
		expect(
			await resolveActorContext({ companies }, agencyMember, companyB.id),
		).toEqual({
			userId: agencyMember.userId,
			kind: "agency_member",
			agencyId: "agency-1",
			companyId: companyB.id,
			scopes: ["read"],
		});
	});

	it("RN-021: o membro da agência sem empresa informada recebe o pedido de informá-la", async () => {
		await expect(
			resolveActorContext({ companies }, agencyMember, undefined),
		).rejects.toThrow("Informe em qual empresa cliente você quer trabalhar.");
	});

	it("RN-010: o membro da agência não opera em empresa de outra agência", async () => {
		await expect(
			resolveActorContext({ companies }, agencyMember, otherAgencyCompany.id),
		).rejects.toThrow(NO_ACCESS);
	});

	it("empresa inexistente responde como sem acesso, sem revelar que não existe", async () => {
		await expect(
			resolveActorContext({ companies }, agencyMember, "nao-existe"),
		).rejects.toThrow(NO_ACCESS);
	});
});
