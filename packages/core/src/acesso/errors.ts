import { DomainError } from "../shared/domain-error";

/** RN-015: também usado para empresa inexistente, para não revelar quais empresas existem. */
export function noAccessToCompany(): DomainError {
	return new DomainError("no_access", "Você não tem acesso a esta empresa.");
}

/** RN-021, RN-022. */
export function companyRequired(): DomainError {
	return new DomainError(
		"company_required",
		"Informe em qual empresa cliente você quer trabalhar.",
	);
}
