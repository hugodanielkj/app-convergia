/** Quem chama e em qual empresa a operação acontece (RN-020, RN-021). */
export type ActorKind = "agency_member" | "client_user";

export type ActorScope = "read" | "write";

export type ActorContext = {
	userId: string;
	kind: ActorKind;
	agencyId: string;
	companyId: string;
	scopes: ActorScope[];
};
