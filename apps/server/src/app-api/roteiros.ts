import {
	type AuthenticatedUser,
	generateScripts,
	getRefineChat,
	PREVIEW_DECISIONS,
	parseInput,
	refineContent,
	refineContentInput,
	resolveActorContext,
	reviewContentRefinement,
	type ScriptDeps,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import type { AppEnv } from "./env";

const decisionParam = z.object({ decision: z.enum(PREVIEW_DECISIONS) });

/** Gerar e refinar o roteiro de um card (✅ RN-006; RN-070 a RN-074). */
export function scriptRoutes(deps: ScriptDeps) {
	const actorFor = (user: AuthenticatedUser, companyId: string) =>
		resolveActorContext(deps, user, companyId);
	const base = "/companies/:companyId/contents/:contentId";

	return new Hono<AppEnv>()
		.post(`${base}/script`, async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			const [content] = await generateScripts(deps, actor, [
				c.req.param("contentId"),
			]);
			return c.json(content);
		})
		.get(`${base}/refine`, async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json({
				messages: await getRefineChat(deps, actor, c.req.param("contentId")),
			});
		})
		.post(
			`${base}/refine`,
			validator("json", (value) => parseInput(refineContentInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json({
					messages: await refineContent(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.valid("json").message,
					),
				});
			},
		)
		.post(
			`${base}/refine/:messageId/:decision`,
			validator("param", (value) => ({
				...(value as Record<string, string>),
				...parseInput(decisionParam, value),
			})),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await reviewContentRefinement(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.param("messageId"),
						c.req.valid("param").decision,
					),
				);
			},
		);
}
