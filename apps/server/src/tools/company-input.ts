import {
	type ActorContext,
	type AuthenticatedUser,
	type CompanyRepository,
	resolveActorContext,
} from "@convergia/core";
import { z } from "zod";

/**
 * Parâmetro `company_id` das ferramentas que operam dentro de uma empresa (RN-022).
 * Só o membro da agência o vê; o usuário do cliente opera sempre na própria empresa.
 */
export function companyIdInput(user: AuthenticatedUser) {
	return user.kind === "agency_member"
		? {
				company_id: z
					.string()
					.describe(
						"ID da empresa cliente em que você quer trabalhar. Use list_companies para ver as empresas.",
					),
			}
		: {};
}

export function actorFor(
	deps: { companies: CompanyRepository },
	user: AuthenticatedUser,
	input: { company_id?: string },
): Promise<ActorContext> {
	return resolveActorContext(deps, user, input.company_id);
}
