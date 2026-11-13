import {
	type AuthenticatedUser,
	type CompanyRepository,
	type DiscoveryDeps,
	discoverVideos,
	getVideoSearch,
	parseInput,
	resolveActorContext,
	videoSearchInput,
	videoSearchPageInput,
} from "@convergia/core";
import { Hono } from "hono";
import { validator } from "hono/validator";
import type { AppEnv } from "./env";

/** Descoberta de vídeos do Instagram Reels e do TikTok (✅ RN-110 a RN-119). */
export function discoveryRoutes(
	deps: DiscoveryDeps & { companies: CompanyRepository },
) {
	const actorFor = (user: AuthenticatedUser, companyId: string) =>
		resolveActorContext(deps, user, companyId);
	const base = "/companies/:companyId/videos/searches";

	return new Hono<AppEnv>()
		.post(
			base,
			validator("json", (value) => parseInput(videoSearchInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(await discoverVideos(deps, actor, c.req.valid("json")));
			},
		)
		.get(
			`${base}/:requestId`,
			validator("query", (value) => parseInput(videoSearchPageInput, value)),
			async (c) => {
				const actor = await actorFor(c.get("user"), c.req.param("companyId"));
				return c.json(
					await getVideoSearch(
						deps,
						actor,
						c.req.param("requestId"),
						c.req.valid("query"),
					),
				);
			},
		);
}
