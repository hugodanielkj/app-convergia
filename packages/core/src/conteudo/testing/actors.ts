import type { ActorContext } from "../../shared/actor-context";

export const client: ActorContext = {
	userId: "user-client",
	kind: "client_user",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: ["read", "write"],
};

export const agency: ActorContext = {
	userId: "user-agency",
	kind: "agency_member",
	agencyId: "agency-1",
	companyId: "company-a",
	scopes: ["read", "write"],
};

export const otherCompanyClient: ActorContext = {
	...client,
	userId: "user-other",
	companyId: "company-b",
};

export const readOnly: ActorContext = { ...client, scopes: ["read"] };
