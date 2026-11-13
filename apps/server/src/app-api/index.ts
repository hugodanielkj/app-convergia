import {
	type CompanyRepository,
	type ContentRepository,
	type DiscoveryDeps,
	listCompanies,
	type QuotaRepository,
	resolveActorContext,
	type ScriptAi,
	type ScriptRepository,
	whoami,
} from "@convergia/core";
import { Hono } from "hono";
import type { Authenticate } from "../auth/authenticate";
import { contentRoutes } from "./conteudo";
import { discoveryRoutes } from "./descoberta";
import type { AppEnv } from "./env";
import { toAppError } from "./errors";
import { scriptRoutes } from "./roteiros";

export type AppApiDeps = DiscoveryDeps & {
	authenticate: Authenticate;
	companies: CompanyRepository;
	contents: ContentRepository;
	scripts: ScriptRepository;
	scriptAi: ScriptAi;
	quotas: QuotaRepository;
	now: () => Date;
};

/**
 * API JSON do app web (RN-003). Chama os mesmos casos de uso das ferramentas MCP.
 * Até o login ser definido (Q-31, Q-32), autentica pela chave de API, como o MCP.
 */
export function createAppApi(deps: AppApiDeps) {
	const { authenticate, companies } = deps;
	return new Hono<AppEnv>()
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
		})
		.route("/", contentRoutes(deps))
		.route("/", scriptRoutes(deps))
		.route("/", discoveryRoutes(deps));
}

export type AppApi = ReturnType<typeof createAppApi>;
