import type { AuthenticatedUser } from "@convergia/core";
import { InMemoryCompanyRepository } from "@convergia/core/testing";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actorFor, companyIdInput } from "./company-input";

const agencyMember: AuthenticatedUser = {
	kind: "agency_member",
	userId: "user-1",
	agencyId: "agency-1",
	scopes: ["read"],
};

const clientUser: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-2",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: ["read"],
};

const companies = new InMemoryCompanyRepository([
	{ id: "company-a", agencyId: "agency-1", name: "Loja Alfa" },
]);

describe("parâmetro company_id", () => {
	it("RN-022: o membro da agência precisa informar company_id", () => {
		const schema = z.object(companyIdInput(agencyMember));

		expect(schema.safeParse({}).success).toBe(false);
		expect(schema.safeParse({ company_id: "company-a" }).success).toBe(true);
	});

	it("RN-021: o usuário do cliente não vê o parâmetro", () => {
		expect(companyIdInput(clientUser)).toEqual({});
	});

	it("RN-022: monta o contexto na empresa informada pelo membro da agência", async () => {
		const actor = await actorFor({ companies }, agencyMember, {
			company_id: "company-a",
		});

		expect(actor.companyId).toBe("company-a");
	});

	it("RN-021: o usuário do cliente opera na própria empresa", async () => {
		const actor = await actorFor({ companies }, clientUser, {});

		expect(actor.companyId).toBe("company-a");
	});
});
