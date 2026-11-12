import { describe, expect, it } from "vitest";
import { agencyMember, clientOfA } from "../testing/fixtures";
import { whoami } from "./whoami";

describe("whoami", () => {
	it("RN-021: usuário do cliente vê a própria identidade e a própria empresa", () => {
		expect(whoami(clientOfA)).toEqual({
			userId: clientOfA.userId,
			kind: "client_user",
			agencyId: "agency-1",
			companyId: "company-a",
			scopes: ["read", "write"],
		});
	});

	it("RN-022: membro da agência não tem empresa fixa", () => {
		expect(whoami(agencyMember).companyId).toBeNull();
	});

	it("não expõe a lista de escopos do usuário para mutação", () => {
		whoami(agencyMember).scopes.push("write");

		expect(agencyMember.scopes).toEqual(["read"]);
	});
});
