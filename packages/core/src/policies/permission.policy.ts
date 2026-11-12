import type { AuthenticatedUser } from "../acesso/authenticated-user";
import { companyRequired, noAccessToCompany } from "../acesso/errors";
import type { CompanyRepository } from "../acesso/ports/company-repository";
import type { ActorContext } from "../shared/actor-context";
import { DomainError } from "../shared/domain-error";

/**
 * Monta o contexto do ator para uma chamada que opera dentro de uma empresa (RN-020, RN-021).
 * `requestedCompanyId` é o parâmetro `company_id` da chamada (RN-022).
 */
export async function resolveActorContext(
	deps: { companies: CompanyRepository },
	user: AuthenticatedUser,
	requestedCompanyId: string | undefined,
): Promise<ActorContext> {
	return {
		userId: user.userId,
		kind: user.kind,
		agencyId: user.agencyId,
		companyId: await operatingCompany(deps, user, requestedCompanyId),
		scopes: [...user.scopes],
	};
}

async function operatingCompany(
	deps: { companies: CompanyRepository },
	user: AuthenticatedUser,
	requestedCompanyId: string | undefined,
): Promise<string> {
	if (user.kind === "client_user") {
		// RN-015, RN-021: o usuário do cliente opera sempre na própria empresa.
		if (requestedCompanyId && requestedCompanyId !== user.companyId) {
			throw noAccessToCompany();
		}
		return user.companyId;
	}
	// RN-022: o membro da agência informa a empresa em cada chamada; não há empresa ativa.
	if (!requestedCompanyId) {
		throw companyRequired();
	}
	// RN-010: vê todas as empresas da própria agência, e só elas.
	const company = await deps.companies.findInAgency(
		requestedCompanyId,
		user.agencyId,
	);
	if (!company) {
		throw noAccessToCompany();
	}
	return company.id;
}

/** 📎 RN-024: conexão só de leitura não escreve. */
export function assertCanWrite(actor: ActorContext): void {
	if (!actor.scopes.includes("write")) {
		throw new DomainError(
			"read_only",
			"Esta conexão é só de leitura. Reconecte com permissão de escrita.",
		);
	}
}
