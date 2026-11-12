import type { Company, CompanyRepository } from "../ports/company-repository";

/** Dublê do repositório de empresas para testes unitários. */
export class InMemoryCompanyRepository implements CompanyRepository {
	constructor(private readonly companies: Company[]) {}

	async findInAgency(
		companyId: string,
		agencyId: string,
	): Promise<Company | null> {
		return (
			this.companies.find(
				(c) => c.id === companyId && c.agencyId === agencyId,
			) ?? null
		);
	}

	async listByAgency(agencyId: string): Promise<Company[]> {
		return this.companies.filter((c) => c.agencyId === agencyId);
	}
}
