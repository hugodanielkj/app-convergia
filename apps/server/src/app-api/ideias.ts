import {
	acceptBrainstormSuggestion,
	brainstormInput,
	dismissBrainstormSuggestion,
	type IdeaDeps,
	listBrainstormSuggestions,
	parseInput,
	regenerateBrainstorm,
	resolveActorContext,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import type { AppEnv } from "./env";
export function ideaRoutes(deps: IdeaDeps) {
	const base = "/companies/:companyId/ideas";
	return new Hono<AppEnv>()
		.get(base, async (c) =>
			c.json({
				ideas: await listBrainstormSuggestions(
					deps,
					await resolveActorContext(
						deps,
						c.get("user"),
						c.req.param("companyId"),
					),
				),
			}),
		)
		.post(
			base,
			validator("json", (v) => parseInput(brainstormInput, v)),
			async (c) =>
				c.json({
					ideas: await regenerateBrainstorm(
						deps,
						await resolveActorContext(
							deps,
							c.get("user"),
							c.req.param("companyId"),
						),
						c.req.valid("json"),
					),
				}),
		)
		.post(`${base}/:ideaId/accept`, async (c) =>
			c.json(
				await acceptBrainstormSuggestion(
					deps,
					await resolveActorContext(
						deps,
						c.get("user"),
						c.req.param("companyId"),
					),
					c.req.param("ideaId"),
				),
			),
		)
		.delete(`${base}/:ideaId`, async (c) => {
			await dismissBrainstormSuggestion(
				deps,
				await resolveActorContext(
					deps,
					c.get("user"),
					c.req.param("companyId"),
				),
				c.req.param("ideaId"),
			);
			return c.json({ ok: true });
		});
}
