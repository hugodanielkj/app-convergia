import type { AuthenticatedUser } from "../authenticated-user";
import type { Company, CompanyRepository } from "../ports/company-repository";

/**
 * Empresas em que o usuário pode operar. Não recebe `ActorContext` porque roda antes de
 * escolher uma empresa: é como o membro da agência descobre o `company_id` (RN-022).
 */
export async function listCompanies(
	deps: { companies: CompanyRepository },
	user: AuthenticatedUser,
): Promise<Company[]> {
	if (user.kind === "client_user") {
		// RN-015: o usuário do cliente só enxerga a própria empresa.
		const own = await deps.companies.findInAgency(
			user.companyId,
			user.agencyId,
		);
		return own ? [own] : [];
	}
	// RN-010: todo membro da agência vê todos os clientes da agência.
	return deps.companies.listByAgency(user.agencyId);
}
