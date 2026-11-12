import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../shared/actor-context";
import { whoami } from "./whoami";

describe("whoami", () => {
	it("RN-021: usuário do cliente vê a própria identidade e a própria empresa", () => {
		const actor: ActorContext = {
			userId: "user-1",
			kind: "client_user",
			agencyId: "agency-1",
			companyId: "company-1",
			scopes: ["read", "write"],
		};

		expect(whoami(actor)).toEqual(actor);
	});

	it("não expõe a lista de escopos do contexto para mutação", () => {
		const actor: ActorContext = {
			userId: "user-2",
			kind: "agency_member",
			agencyId: "agency-1",
			companyId: "company-2",
			scopes: ["read"],
		};

		whoami(actor).scopes.push("write");

		expect(actor.scopes).toEqual(["read"]);
	});
});
