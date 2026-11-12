import {
	type AuthenticatedUser,
	type CompanyRepository,
	listCompanies,
	resolveActorContext,
	whoami,
} from "@convergia/core";
import { Hono } from "hono";
import type { Authenticate } from "../auth/authenticate";
import { toAppError } from "./errors";

export type AppApiDeps = {
	authenticate: Authenticate;
	companies: CompanyRepository;
};

type Env = { Variables: { user: AuthenticatedUser } };

/**
 * API JSON do app web (RN-003). Chama os mesmos casos de uso das ferramentas MCP.
 * Até o login ser definido (Q-31, Q-32), autentica pela chave de API, como o MCP.
 */
export function createAppApi({ authenticate, companies }: AppApiDeps) {
	return new Hono<Env>()
		.onError((error, c) => {
			const { status, body } = toAppError(error);
			return c.json(body, status);
		})
		.use(async (c, next) => {
			c.set("user", await authenticate(c.req.raw));
			await next();
		})
		.get("/me", (c) => c.json(whoami(c.get("user"))))
		.get("/companies", async (c) => {
			const list = await listCompanies({ companies }, c.get("user"));
			return c.json({ companies: list.map(({ id, name }) => ({ id, name })) });
		})
		.get("/companies/:companyId", async (c) => {
			// RN-022: a empresa vem da URL; a política confere se o usuário pode operar nela.
			const actor = await resolveActorContext(
				{ companies },
				c.get("user"),
				c.req.param("companyId"),
			);
			const company = await companies.findInAgency(
				actor.companyId,
				actor.agencyId,
			);
			if (!company) {
				throw new Error(`Empresa ${actor.companyId} sumiu durante a chamada.`);
			}
			return c.json({ id: company.id, name: company.name });
		});
}

export type AppApi = ReturnType<typeof createAppApi>;
