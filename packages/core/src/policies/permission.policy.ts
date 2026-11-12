import type { AuthenticatedUser } from "../acesso/authenticated-user";
import type { ActorContext } from "../shared/actor-context";
import { NotDecidedYet } from "../shared/domain-error";

/** Monta o contexto do ator a partir de quem se autenticou (RN-020, RN-021). */
export function buildActorContext(user: AuthenticatedUser): ActorContext {
	return {
		userId: user.userId,
		kind: user.kind,
		agencyId: user.agencyId,
		companyId: operatingCompany(user),
		scopes: [...user.scopes],
	};
}

function operatingCompany(user: AuthenticatedUser): string {
	if (user.kind === "client_user") {
		// RN-015, RN-021: o usuário do cliente opera sempre na própria empresa.
		return user.companyId;
	}
	// RN-022: o membro da agência escolhe a empresa por parâmetro ou por "empresa ativa"?
	throw new NotDecidedYet("Q-03");
}
