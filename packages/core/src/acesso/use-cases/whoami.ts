import type { AuthenticatedUser } from "../authenticated-user";

export type WhoamiResult = {
	userId: string;
	kind: AuthenticatedUser["kind"];
	agencyId: string;
	/** null para o membro da agência, que informa a empresa em cada chamada (RN-022). */
	companyId: string | null;
	scopes: AuthenticatedUser["scopes"];
};

/** Devolve a identidade de quem está conectado (RN-020). */
export function whoami(user: AuthenticatedUser): WhoamiResult {
	return {
		userId: user.userId,
		kind: user.kind,
		agencyId: user.agencyId,
		companyId: user.kind === "client_user" ? user.companyId : null,
		scopes: [...user.scopes],
	};
}
