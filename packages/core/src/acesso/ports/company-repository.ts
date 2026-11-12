export type Company = {
	id: string;
	agencyId: string;
	name: string;
};

export interface CompanyRepository {
	/** A empresa, se ela existe e é atendida por essa agência. */
	findInAgency(companyId: string, agencyId: string): Promise<Company | null>;
	listByAgency(agencyId: string): Promise<Company[]>;
}
