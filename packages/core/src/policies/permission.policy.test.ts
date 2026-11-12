import { describe, expect, it } from "vitest";
import { NotDecidedYet } from "../shared/domain-error";
import { buildActorContext } from "./permission.policy";

describe("buildActorContext", () => {
	it("RN-021: o usuário do cliente opera sempre na própria empresa", () => {
		expect(
			buildActorContext({
				kind: "client_user",
				userId: "user-1",
				agencyId: "agency-1",
				companyId: "company-1",
				scopes: ["read", "write"],
			}),
		).toEqual({
			userId: "user-1",
			kind: "client_user",
			agencyId: "agency-1",
			companyId: "company-1",
			scopes: ["read", "write"],
		});
	});

	it("Q-03: a empresa do membro da agência depende de como ele a escolhe", () => {
		const build = () =>
			buildActorContext({
				kind: "agency_member",
				userId: "user-2",
				agencyId: "agency-1",
				scopes: ["read"],
			});

		expect(build).toThrow(NotDecidedYet);
		expect(build).toThrow("Q-03");
	});
});
