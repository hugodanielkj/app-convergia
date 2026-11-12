import {
	type AuthenticatedUser,
	type CompanyRepository,
	type ContentRepository,
	calendarRangeInput,
	contentUpdateInput,
	createContents,
	deleteContent,
	duplicateContent,
	getCalendar,
	getContent,
	KANBAN_STATUSES,
	listContents,
	listDeletedContents,
	moveContent,
	moveContentInput,
	newContentInput,
	parseInput,
	plannedDateInput,
	resolveActorContext,
	restoreContent,
	scheduleContent,
	updateContent,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import type { AppEnv } from "./env";

export type ContentApiDeps = {
	companies: CompanyRepository;
	contents: ContentRepository;
	now: () => Date;
};

const listQuery = z.object({ status: z.enum(KANBAN_STATUSES).optional() });

function withoutUndefined<T extends object>(
	value: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
	return Object.fromEntries(
		Object.entries(value).filter(([, v]) => v !== undefined),
	) as { [K in keyof T]: Exclude<T[K], undefined> };
}
const scheduleBody = z.object({ plannedDate: plannedDateInput.nullable() });

/** Cards, kanban, calendário e lixeira (RN-060 a RN-069), dentro de uma empresa (RN-022). */
export function contentRoutes(deps: ContentApiDeps) {
	const actorFor = (user: AuthenticatedUser, companyId: string) =>
		resolveActorContext(deps, user, companyId);

	return new Hono<AppEnv>()
		.get(
			"/companies/:companyId/contents",
			validator("query", (value) => parseInput(listQuery, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json({
					contents: await listContents(
						deps,
						actor,
						withoutUndefined(c.req.valid("query")),
					),
				});
			},
		)
		.post(
			"/companies/:companyId/contents",
			validator("json", (value) => parseInput(newContentInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				const [content] = await createContents(deps, actor, [
					c.req.valid("json"),
				]);
				return c.json(content, 201);
			},
		)
		.get("/companies/:companyId/contents/:contentId", async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json(await getContent(deps, actor, c.req.param("contentId")));
		})
		.patch(
			"/companies/:companyId/contents/:contentId",
			validator("json", (value) => parseInput(contentUpdateInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await updateContent(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.valid("json"),
					),
				);
			},
		)
		.post(
			"/companies/:companyId/contents/:contentId/move",
			validator("json", (value) => parseInput(moveContentInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await moveContent(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.valid("json"),
					),
				);
			},
		)
		.put(
			"/companies/:companyId/contents/:contentId/schedule",
			validator("json", (value) => parseInput(scheduleBody, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await scheduleContent(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.valid("json").plannedDate,
					),
				);
			},
		)
		.post("/companies/:companyId/contents/:contentId/duplicate", async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json(
				await duplicateContent(deps, actor, c.req.param("contentId")),
				201,
			);
		})
		.delete("/companies/:companyId/contents/:contentId", async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json(await deleteContent(deps, actor, c.req.param("contentId")));
		})
		.post("/companies/:companyId/contents/:contentId/restore", async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json(
				await restoreContent(deps, actor, c.req.param("contentId")),
			);
		})
		.get(
			"/companies/:companyId/calendar",
			validator("query", (value) => parseInput(calendarRangeInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json({
					contents: await getCalendar(deps, actor, c.req.valid("query")),
				});
			},
		)
		.get("/companies/:companyId/trash", async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json({ contents: await listDeletedContents(deps, actor) });
		});
}
