import {
	type AuthenticatedUser,
	generateScriptOptions,
	generateScripts,
	getRefineChat,
	listContentGenerations,
	PREVIEW_DECISIONS,
	parseInput,
	refineContent,
	refineContentInput,
	resolveActorContext,
	reviewContentRefinement,
	SCRIPT_FIELDS,
	type ScriptDeps,
	scriptOptionsInput,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import type { AppEnv } from "./env";

const reviewParams = z.object({
	companyId: z.string(),
	contentId: z.string(),
	messageId: z.string(),
	decision: z.enum(PREVIEW_DECISIONS),
});

const optionsParams = z.object({
	companyId: z.string(),
	contentId: z.string(),
	field: z.enum(SCRIPT_FIELDS),
});
const optionsBody = scriptOptionsInput.pick({ count: true });

/** Gerar, refinar e ver o histórico do roteiro de um card (✅ RN-006; RN-070 a RN-074). */
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
		.post(
			`${base}/options/:field`,
			validator("param", (value) => parseInput(optionsParams, value)),
			validator("json", (value) => parseInput(optionsBody, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await generateScriptOptions(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.valid("param").field,
						c.req.valid("json").count,
					),
				);
			},
		)
		.get(`${base}/history`, async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json({
				entries: await listContentGenerations(
					deps,
					actor,
					c.req.param("contentId"),
				),
			});
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
			validator("param", (value) => parseInput(reviewParams, value)),
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
