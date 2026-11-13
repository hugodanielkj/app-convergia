import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import {
	type ActorContext,
	DEFAULT_DISCOVERY_SETTINGS,
	type DiscoveryDeps,
	discoverVideos,
	getVideoSearch,
	runVideoQuery,
	type VideoSearchView,
} from "@convergia/core";
import { FakeVideoProvider, testVideo } from "@convergia/core/testing";
import { eq, inArray, like, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createDiscoveryQueue,
	startJobs,
	workDiscoveryQueue,
} from "../../jobs/discovery-queue";
import { createDb } from "../client";
import {
	agencies,
	companies,
	discoveredVideos,
	quotaUsage,
	users,
	videoMetricObservations,
	videoQueries,
	videoQueryResults,
	videoSearchRequests,
} from "../schema";
import { withCompany } from "../with-company";
import { createDiscoveryRepository } from "./discovery.repository";
import { createQuotaRepository } from "./quota.repository";

describe("descoberta de vídeos no Postgres (RN-110 a RN-119)", () => {
	const env = loadEnv();
	const db = createDb(env.DATABASE_URL);
	const discovery = createDiscoveryRepository(db);
	const provider = new FakeVideoProvider();
	const run = randomUUID().slice(0, 8);
	const ids = {
		agency: "",
		companyA: "",
		companyB: "",
		clientA: "",
		clientB: "",
	};
	let actorA: ActorContext;
	let actorB: ActorContext;
	let boss: PgBoss;
	let deps: DiscoveryDeps;

	const recent = new Date(Date.now() - 86_400_000);
	const video = (
		externalId: string,
		extra: Parameters<typeof testVideo>[0] = { externalId },
	) =>
		testVideo({
			platform: "tiktok",
			caption: `Como criar vídeos com IA ${run}`,
			publishedAt: recent,
			...extra,
			externalId: `${run}-${externalId}`,
		});

	beforeAll(async () => {
		const [agency] = await db
			.insert(agencies)
			.values({ name: `Agência ${run}` })
			.returning();
		ids.agency = agency?.id ?? "";
		const created = await db
			.insert(companies)
			.values([
				{ agencyId: ids.agency, name: "A" },
				{ agencyId: ids.agency, name: "B" },
			])
			.returning();
		ids.companyA = created[0]?.id ?? "";
		ids.companyB = created[1]?.id ?? "";
		const people = await db
			.insert(users)
			.values(
				[ids.companyA, ids.companyB].map((companyId, i) => ({
					agencyId: ids.agency,
					companyId,
					kind: "client_user" as const,
					name: `Cliente ${i}`,
					email: `descoberta-${i}-${run}@exemplo.test`,
				})),
			)
			.returning();
		ids.clientA = people[0]?.id ?? "";
		ids.clientB = people[1]?.id ?? "";
		const base = {
			kind: "client_user" as const,
			agencyId: ids.agency,
			scopes: ["read" as const, "write" as const],
		};
		actorA = { ...base, userId: ids.clientA, companyId: ids.companyA };
		actorB = { ...base, userId: ids.clientB, companyId: ids.companyB };

		boss = await startJobs(env.DATABASE_URL);
		deps = {
			discovery,
			videoProvider: provider,
			discoveryQueue: createDiscoveryQueue(boss),
			queryExpander: null,
			quotas: createQuotaRepository(db),
			discoverySettings: { ...DEFAULT_DISCOVERY_SETTINGS, maxPagesPerTerm: 1 },
			now: () => new Date(),
		};
		await workDiscoveryQueue(boss, (queryId) => runVideoQuery(deps, queryId));
	});

	afterAll(async () => {
		await boss.stop({ graceful: false });
		const queries = await db
			.select({ id: videoQueries.id })
			.from(videoQueries)
			.where(like(videoQueries.queryText, `%${run}%`));
		const queryIds = queries.map((q) => q.id);
		for (const companyId of [ids.companyA, ids.companyB]) {
			await withCompany(db, companyId, async (tx) => {
				await tx
					.delete(videoSearchRequests)
					.where(eq(videoSearchRequests.companyId, companyId));
				await tx.delete(quotaUsage).where(eq(quotaUsage.companyId, companyId));
			});
		}
		if (queryIds.length > 0) {
			await db
				.delete(videoQueryResults)
				.where(inArray(videoQueryResults.queryId, queryIds));
			await db.delete(videoQueries).where(inArray(videoQueries.id, queryIds));
		}
		const videos = await db
			.select({ id: discoveredVideos.id })
			.from(discoveredVideos)
			.where(like(discoveredVideos.externalId, `${run}-%`));
		const videoIds = videos.map((v) => v.id);
		if (videoIds.length > 0) {
			await db
				.delete(videoQueryResults)
				.where(inArray(videoQueryResults.videoId, videoIds));
			await db
				.delete(videoMetricObservations)
				.where(inArray(videoMetricObservations.videoId, videoIds));
			await db
				.delete(discoveredVideos)
				.where(inArray(discoveredVideos.id, videoIds));
		}
		await db.delete(users).where(inArray(users.id, [ids.clientA, ids.clientB]));
		await db
			.delete(companies)
			.where(inArray(companies.id, [ids.companyA, ids.companyB]));
		await db.delete(agencies).where(eq(agencies.id, ids.agency));
		await db.$client.end();
	});

	async function waitUntilDone(requestId: string): Promise<VideoSearchView> {
		for (let i = 0; i < 60; i++) {
			const view = await getVideoSearch(deps, actorA, requestId, {
				sort: "relevance",
				offset: 0,
			});
			if (view.status !== "collecting" && view.status !== "refreshing")
				return view;
			await new Promise((done) => setTimeout(done, 250));
		}
		throw new Error("A coleta não terminou a tempo.");
	}

	it("coleta pela fila do pg-boss, grava no catálogo e responde do cache depois", async () => {
		provider.pages = {
			tiktok: [
				{
					videos: [
						video("a", {
							externalId: "a",
							metrics: { views: 1_000, likes: 50 },
						}),
						video("b", { externalId: "b", caption: "Receita de bolo" }),
					],
					nextCursor: null,
				},
			],
		};
		const query = `Como criar vídeos com IA ${run}`;
		const first = await discoverVideos(deps, actorA, {
			query,
			platform: "tiktok",
			period: "30d",
			sort: "relevance",
		});
		expect(first.status).toBe("collecting");

		const done = await waitUntilDone(first.requestId ?? "");
		expect(done.status).toBe("ready");
		expect(done.results.map((v) => v.externalId)).toEqual([`${run}-a`]);
		expect(done.results[0]?.metrics).toEqual({
			views: 1_000,
			likes: 50,
			comments: null,
			shares: null,
		});

		const calls = provider.calls.length;
		const again = await discoverVideos(deps, actorB, {
			query: `  como criar VIDEOS com ia ${run} `,
			platform: "tiktok",
			period: "30d",
			sort: "popularity",
		});
		expect(again.status).toBe("ready");
		expect(again.results).toHaveLength(1);
		expect(provider.calls).toHaveLength(calls);
	});

	it("RN-112: o mesmo vídeo não se repete e campo vazio não apaga o que já se sabia", async () => {
		const now = new Date();
		const [first] = await discovery.upsertVideos(
			[video("c", { externalId: "c", metrics: { views: 10, likes: 2 } })],
			"teste",
			now,
		);
		const [second] = await discovery.upsertVideos(
			[video("c", { externalId: "c", caption: null, metrics: { views: 25 } })],
			"teste",
			new Date(now.getTime() + 1_000),
		);
		expect(second?.id).toBe(first?.id);
		expect(second?.caption).toBe(`Como criar vídeos com IA ${run}`);
		expect(second?.metrics).toEqual({
			views: 25,
			likes: 2,
			comments: null,
			shares: null,
		});

		const [noMetrics] = await discovery.upsertVideos(
			[video("d", { externalId: "d" })],
			"teste",
			now,
		);
		expect(noMetrics?.metrics).toEqual({
			views: null,
			likes: null,
			comments: null,
			shares: null,
		});
		expect(noMetrics?.metricsObservedAt).toBeNull();

		const observations = await discovery.listObservations(
			[first?.id ?? "", noMetrics?.id ?? ""],
			new Date(now.getTime() - 1_000),
		);
		expect(observations.map((o) => o.views)).toEqual(
			expect.arrayContaining([10, 25]),
		);
		expect(observations).toHaveLength(2);
	});

	it("RN-015: a pesquisa de uma empresa não aparece para outra, nem pelo RLS", async () => {
		const created = await discovery.createQuery({
			cacheKey: `teste|${run}|isolamento`,
			queryText: `isolamento ${run}`,
			platforms: ["tiktok"],
			period: "any",
			requestedByCompanyId: ids.companyA,
		});
		const request = await discovery.createRequest({
			companyId: ids.companyA,
			userId: ids.clientA,
			queryId: created.query.id,
			cacheStatus: "miss",
			quotaDay: "2026-11-13",
		});
		await expect(
			discovery.findRequest(ids.companyB, request.id),
		).resolves.toBeNull();
		await expect(
			discovery.findRequest(ids.companyA, request.id),
		).resolves.toMatchObject({
			id: request.id,
		});
		// Superusuário ignora o RLS; um papel comum, como o do servidor em produção, não.
		await db.execute(sql`
			do $$ begin
				if not exists (select from pg_roles where rolname = 'convergia_rls_probe') then
					create role convergia_rls_probe nologin;
				end if;
			end $$`);
		await db.execute(sql`grant usage on schema public to convergia_rls_probe`);
		await db.execute(
			sql`grant select on video_search_requests to convergia_rls_probe`,
		);
		const visibleTo = (companyId: string) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`set local role convergia_rls_probe`);
				await tx.execute(
					sql`select set_config('app.company_id', ${companyId}, true)`,
				);
				const rows = await tx.execute<{ total: number }>(
					sql`select count(*)::int as total from video_search_requests where id = ${request.id}`,
				);
				return rows[0]?.total ?? -1;
			});
		await expect(visibleTo(ids.companyB)).resolves.toBe(0);
		await expect(visibleTo(ids.companyA)).resolves.toBe(1);
		await expect(
			discovery.countCollections(
				ids.companyA,
				ids.clientA,
				new Date(Date.now() - 60_000),
			),
		).resolves.toBeGreaterThanOrEqual(1);
		await expect(
			discovery.countCollections(
				ids.companyB,
				ids.clientA,
				new Date(Date.now() - 60_000),
			),
		).resolves.toBe(0);
	});

	it("RN-114, RN-305: pesquisa igual não duplica; reservas são encerradas uma vez só", async () => {
		const input = {
			cacheKey: `teste|${run}|reservas`,
			queryText: `reservas ${run}`,
			platforms: ["tiktok" as const],
			period: "any" as const,
			requestedByCompanyId: ids.companyA,
		};
		const first = await discovery.createQuery(input);
		const second = await discovery.createQuery(input);
		expect(first.created).toBe(true);
		expect(second).toMatchObject({
			created: false,
			query: { id: first.query.id },
		});

		await discovery.createRequest({
			companyId: ids.companyB,
			userId: ids.clientB,
			queryId: first.query.id,
			cacheStatus: "miss",
			quotaDay: "2026-11-13",
		});
		await expect(discovery.settleReservations(first.query.id)).resolves.toEqual(
			[{ companyId: ids.companyB, userId: ids.clientB, day: "2026-11-13" }],
		);
		await expect(discovery.settleReservations(first.query.id)).resolves.toEqual(
			[],
		);

		// Só um processo pega a coleta; parada recente não volta para a fila.
		const now = new Date();
		await expect(
			discovery.claimQuery(first.query.id, now),
		).resolves.toMatchObject({ status: "running" });
		await expect(discovery.claimQuery(first.query.id, now)).resolves.toBeNull();
		await expect(
			discovery.requeue(
				first.query.id,
				ids.companyA,
				new Date(now.getTime() - 60_000),
			),
		).resolves.toBe(false);
		await expect(
			discovery.requeue(
				first.query.id,
				ids.companyA,
				new Date(now.getTime() + 60_000),
			),
		).resolves.toBe(true);
	});
});
