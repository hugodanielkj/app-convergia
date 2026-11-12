import { describe, expect, it } from "vitest";
import {
	agencyMember,
	clientOfA,
	companyA,
	companyB,
	otherAgencyCompany,
} from "../testing/fixtures";
import { InMemoryCompanyRepository } from "../testing/in-memory-company-repository";
import { listCompanies } from "./list-companies";

const companies = new InMemoryCompanyRepository([
	companyA,
	companyB,
	otherAgencyCompany,
]);

describe("listCompanies", () => {
	it("RN-010: o membro da agência vê todas as empresas da própria agência", async () => {
		expect(await listCompanies({ companies }, agencyMember)).toEqual([
			companyA,
			companyB,
		]);
	});

	it("RN-015: o usuário do cliente só vê a própria empresa", async () => {
		expect(await listCompanies({ companies }, clientOfA)).toEqual([companyA]);
	});
});
