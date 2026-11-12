import type { ActorScope } from "../shared/actor-context";

/** Dono de uma credencial válida, antes de saber em qual empresa ele vai operar. */
export type AuthenticatedUser =
	| {
			kind: "client_user";
			userId: string;
			agencyId: string;
			companyId: string;
			scopes: ActorScope[];
	  }
	| {
			kind: "agency_member";
			userId: string;
			agencyId: string;
			scopes: ActorScope[];
	  };
