import type { ActorContext } from "../../shared/actor-context";

export type WhoamiResult = {
	userId: string;
	kind: ActorContext["kind"];
	agencyId: string;
	companyId: string;
	scopes: ActorContext["scopes"];
};

/** Devolve a identidade do ator e a empresa em que ele está operando (RN-020, RN-021). */
export function whoami(actor: ActorContext): WhoamiResult {
	return {
		userId: actor.userId,
		kind: actor.kind,
		agencyId: actor.agencyId,
		companyId: actor.companyId,
		scopes: [...actor.scopes],
	};
}
