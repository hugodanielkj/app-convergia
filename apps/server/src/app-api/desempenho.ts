import {
	type AuthenticatedUser,
	type CompanyRepository,
	type ConnectOutcome,
	completeInstagramConnection,
	connectInstagramInput,
	getInstagramConnection,
	type InstagramDeps,
	parseInput,
	resolveActorContext,
	startInstagramConnection,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import type { AppEnv } from "./env";

export type InstagramApiDeps = InstagramDeps & { companies: CompanyRepository };

const UNEXPECTED_ERROR =
	"Ocorreu um erro inesperado. Tente de novo em instantes.";

/** Conexão do Instagram da empresa (RN-034, RN-035), dentro de uma empresa (RN-022). */
export function instagramRoutes(deps: InstagramApiDeps) {
	const actorFor = (user: AuthenticatedUser, companyId: string) =>
		resolveActorContext(deps, user, companyId);

	return new Hono<AppEnv>()
		.get("/companies/:companyId/instagram", async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json({
				...(await getInstagramConnection(deps, actor)),
				simulated: deps.instagramGateway.simulated,
			});
		})
		.post(
			"/companies/:companyId/instagram/connect",
			validator("json", (value) => parseInput(connectInstagramInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await startInstagramConnection(deps, actor, c.req.valid("json")),
				);
			},
		);
}

/**
 * Volta da autenticação da Meta (`INSTAGRAM_REDIRECT_URI`). Não tem chave de API: quem diz de
 * quem é o pedido é o `state`. Devolve a pessoa para a tela Desempenho da empresa, com o
 * resultado na URL.
 */
export function instagramCallback(deps: InstagramDeps) {
	return new Hono().get("/", async (c) => {
		let outcome: Pick<ConnectOutcome, "companyId"> & {
			error: { message: string } | null;
		};
		try {
			outcome = await completeInstagramConnection(deps, {
				state: c.req.query("state") ?? null,
				code: c.req.query("code") ?? null,
				error: c.req.query("error") ?? null,
			});
		} catch (error) {
			console.error("Falha ao concluir a conexão do Instagram", error);
			outcome = { companyId: null, error: { message: UNEXPECTED_ERROR } };
		}
		const params = new URLSearchParams(
			outcome.error
				? { instagram_erro: outcome.error.message }
				: { instagram: "conectado" },
		);
		const path = outcome.companyId
			? `/empresas/${outcome.companyId}/desempenho`
			: "/instagram";
		return c.redirect(`${path}?${params.toString()}`, 302);
	});
}
