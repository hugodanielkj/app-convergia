import {
	APPROVAL_VIEWS,
	type ApprovalDeps,
	type AuthenticatedUser,
	approveInput,
	approveItem,
	type CompanyRepository,
	cancelApprovalRequest,
	getApprovalItem,
	listApprovalItems,
	parseInput,
	rejectInput,
	rejectItem,
	resolveActorContext,
	submitForApproval,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import type { AppEnv } from "./env";

export type ApprovalApiDeps = ApprovalDeps & { companies: CompanyRepository };

const listQuery = z.object({ view: z.enum(APPROVAL_VIEWS).default("pending") });

/** Aprovação do roteiro (regra de negócio §5), dentro de uma empresa (RN-022). */
export function approvalRoutes(deps: ApprovalApiDeps) {
	const actorFor = (user: AuthenticatedUser, companyId: string) =>
		resolveActorContext(deps, user, companyId);
	const base = "/companies/:companyId/contents/:contentId/approval";

	return new Hono<AppEnv>()
		.get(
			"/companies/:companyId/approvals",
			validator("query", (value) => parseInput(listQuery, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json({
					items: await listApprovalItems(
						deps,
						actor,
						c.req.valid("query").view,
					),
				});
			},
		)
		.get(base, async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json(
				await getApprovalItem(deps, actor, c.req.param("contentId")),
			);
		})
		.post(`${base}/submit`, async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json(
				await submitForApproval(deps, actor, c.req.param("contentId")),
			);
		})
		.post(`${base}/cancel`, async (c) => {
			const actor = await actorFor(c.get("user"), c.req.param("companyId"));
			return c.json(
				await cancelApprovalRequest(deps, actor, c.req.param("contentId")),
			);
		})
		.post(
			`${base}/approve`,
			validator("json", (value) => parseInput(approveInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await approveItem(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.valid("json"),
					),
				);
			},
		)
		.post(
			`${base}/reject`,
			validator("json", (value) => parseInput(rejectInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await rejectItem(
						deps,
						actor,
						c.req.param("contentId"),
						c.req.valid("json"),
					),
				);
			},
		);
}
