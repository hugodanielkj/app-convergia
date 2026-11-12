import type { AuthenticatedUser } from "../authenticated-user";
import type { Company } from "../ports/company-repository";

export const companyA: Company = {
	id: "company-a",
	agencyId: "agency-1",
	name: "Empresa A",
};
export const companyB: Company = {
	id: "company-b",
	agencyId: "agency-1",
	name: "Empresa B",
};
export const otherAgencyCompany: Company = {
	id: "company-x",
	agencyId: "agency-2",
	name: "Empresa de outra agência",
};

export const clientOfA: AuthenticatedUser = {
	kind: "client_user",
	userId: "user-client-a",
	agencyId: "agency-1",
	companyId: companyA.id,
	scopes: ["read", "write"],
};

export const agencyMember: AuthenticatedUser = {
	kind: "agency_member",
	userId: "user-agency",
	agencyId: "agency-1",
	scopes: ["read"],
};
