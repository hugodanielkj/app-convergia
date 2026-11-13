import {
	addContentSource,
	attachContentReference,
	attachmentInput,
	type CompanyRepository,
	createContentFromSource,
	createContentSourceUpload,
	deleteSavedReference,
	detachContentReference,
	getContentSource,
	getCreatorAnalysis,
	type KnowledgeDeps,
	listContentReferences,
	listContentSources,
	listSavedReferences,
	parseInput,
	referenceInput,
	resolveActorContext,
	retryContentSource,
	runCreatorDeepAnalysis,
	type SourceDeps,
	saveReferenceByUrl,
	sourceInput,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import type { AppEnv } from "./env";
export type KnowledgeApiDeps = KnowledgeDeps &
	SourceDeps & { companies: CompanyRepository };
export function knowledgeRoutes(d: KnowledgeApiDeps) {
	const saved = "/companies/:companyId/references";
	const card = "/companies/:companyId/contents/:contentId";
	const actor = (c: {
		get: (key: "user") => Parameters<typeof resolveActorContext>[1];
		req: { param: (key: "companyId") => string };
	}) => resolveActorContext(d, c.get("user"), c.req.param("companyId"));
	return new Hono<AppEnv>()
		.get(saved, async (c) =>
			c.json({ references: await listSavedReferences(d, await actor(c)) }),
		)
		.post(
			saved,
			validator("json", (v) => parseInput(referenceInput, v)),
			async (c) => {
				await saveReferenceByUrl(d, await actor(c), c.req.valid("json"));
				return c.json({ ok: true });
			},
		)
		.delete(`${saved}/:referenceId`, async (c) => {
			await deleteSavedReference(d, await actor(c), c.req.param("referenceId"));
			return c.json({ ok: true });
		})
		.get(`${saved}/:referenceId/analysis`, async (c) =>
			c.json(
				await getCreatorAnalysis(d, await actor(c), c.req.param("referenceId")),
			),
		)
		.post(`${saved}/:referenceId/analysis`, async (c) =>
			c.json(
				await runCreatorDeepAnalysis(
					d,
					await actor(c),
					c.req.param("referenceId"),
				),
			),
		)
		.get(`${card}/references`, async (c) =>
			c.json({
				references: await listContentReferences(
					d,
					await actor(c),
					c.req.param("contentId"),
				),
			}),
		)
		.post(
			`${card}/references`,
			validator("json", (v) => parseInput(attachmentInput, v)),
			async (c) =>
				c.json(
					await attachContentReference(
						d,
						await actor(c),
						c.req.param("contentId"),
						c.req.valid("json"),
					),
				),
		)
		.delete(`${card}/references/:referenceId`, async (c) => {
			await detachContentReference(
				d,
				await actor(c),
				c.req.param("contentId"),
				c.req.param("referenceId"),
			);
			return c.json({ ok: true });
		})
		.get(`${card}/sources`, async (c) =>
			c.json({
				sources: await listContentSources(
					d,
					await actor(c),
					c.req.param("contentId"),
				),
			}),
		)
		.get(`${card}/sources/:sourceId`, async (c) =>
			c.json(
				await getContentSource(
					d,
					await actor(c),
					c.req.param("contentId"),
					c.req.param("sourceId"),
				),
			),
		)
		.post(
			`${card}/sources`,
			validator("json", (v) => parseInput(sourceInput, v)),
			async (c) => {
				await addContentSource(d, await actor(c), c.req.param("contentId"));
				return c.json({ ok: true });
			},
		)
		.post(`${card}/sources/:sourceId/retry`, async (c) => {
			await retryContentSource(
				d,
				await actor(c),
				c.req.param("contentId"),
				c.req.param("sourceId"),
			);
			return c.json({ ok: true });
		})
		.post(
			`${card}/source-upload`,
			validator("json", (v) =>
				parseInput(
					z.object({
						size: z
							.number()
							.int()
							.positive()
							.max(10 * 1024 * 1024),
						name: z.string().trim().min(1).max(200),
					}),
					v,
				),
			),
			async (c) => {
				await createContentSourceUpload(
					d,
					await actor(c),
					c.req.param("contentId"),
				);
				return c.json({ ok: true });
			},
		)
		.post(
			"/companies/:companyId/contents/from-source",
			validator("json", (v) => parseInput(sourceInput, v)),
			async (c) => {
				await createContentFromSource(d, await actor(c));
				return c.json({ ok: true });
			},
		);
}
