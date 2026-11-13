import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenCipher } from "../../instagram/token-cipher";
import { createDb } from "../client";
import {
	agencies,
	companies,
	instagramConnections,
	instagramConnectRequests,
	users,
} from "../schema";
import { createInstagramRepository } from "./instagram.repository";

describe("repositório do Instagram", () => {
	const db = createDb(loadEnv().DATABASE_URL);
	const repo = createInstagramRepository(
		db,
		createTokenCipher(Buffer.alloc(32, 3).toString("base64")),
	);
	const run = randomUUID();
	const ids = { agency: "", companyA: "", companyB: "", client: "" };
	const now = new Date("2026-11-13T12:00:00Z");

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
		const [person] = await db
			.insert(users)
			.values({
				agencyId: ids.agency,
				companyId: ids.companyA,
				kind: "client_user",
				name: "Cliente A",
				email: `ig-${run}@exemplo.test`,
			})
			.returning();
		ids.client = person?.id ?? "";
	});

	afterAll(async () => {
		const companyIds = [ids.companyA, ids.companyB];
		for (const id of companyIds) {
			await db.transaction(async (tx) => {
				await tx.execute(sql`select set_config('app.company_id', ${id}, true)`);
				await tx
					.delete(instagramConnections)
					.where(eq(instagramConnections.companyId, id));
			});
		}
		await db
			.delete(instagramConnectRequests)
			.where(inArray(instagramConnectRequests.companyId, companyIds));
		await db.delete(users).where(eq(users.id, ids.client));
		await db.delete(companies).where(inArray(companies.id, companyIds));
		await db.delete(agencies).where(eq(agencies.id, ids.agency));
		await db.$client.end();
	});

	const connection = (overrides: { biography?: string } = {}) => ({
		igUserId: "ig-1",
		username: "empresa_a",
		connectedByUserId: ids.client,
		connectedAt: now,
		accessToken: "token-secreto-do-instagram",
		tokenExpiresAt: new Date("2027-01-12T12:00:00Z"),
		simulated: false,
		snapshot: {
			profile: {
				username: "empresa_a",
				name: "Empresa A",
				biography: overrides.biography ?? "Bio",
				website: null,
				accountType: "business" as const,
				followersCount: 10,
				followsCount: 2,
				mediaCount: 5,
				profilePictureUrl: null,
			},
			posts: [
				{
					id: "p1",
					caption: "Legenda",
					mediaType: "video" as const,
					permalink: null,
					publishedAt: new Date("2026-11-10T12:00:00Z"),
					likeCount: 7,
					commentsCount: 1,
				},
			],
			collectedAt: now,
		},
	});

	it("o pedido de conexão vale uma vez só e até expirar", async () => {
		const hash = `hash-${run}`;
		const request = {
			companyId: ids.companyA,
			userId: ids.client,
			expectedUsername: "empresa_a",
			expiresAt: new Date(now.getTime() + 15 * 60_000),
		};
		await repo.createConnectRequest(hash, request);

		expect(await repo.consumeConnectRequest(hash, now)).toEqual({
			companyId: ids.companyA,
			userId: ids.client,
			expectedUsername: "empresa_a",
		});
		expect(await repo.consumeConnectRequest(hash, now)).toBeNull();

		await repo.createConnectRequest(`${hash}-2`, request);
		expect(
			await repo.consumeConnectRequest(
				`${hash}-2`,
				new Date(now.getTime() + 16 * 60_000),
			),
		).toBeNull();
	});

	it("grava, troca ao reconectar, devolve o retrato com datas e guarda o token cifrado", async () => {
		await repo.saveConnection(ids.companyA, connection());
		const saved = await repo.saveConnection(
			ids.companyA,
			connection({ biography: "Bio nova" }),
		);

		expect(saved.snapshot?.profile.biography).toBe("Bio nova");
		expect(saved.snapshot?.posts[0]?.publishedAt).toEqual(
			new Date("2026-11-10T12:00:00Z"),
		);
		expect(await repo.findToken(ids.companyA)).toEqual({
			accessToken: "token-secreto-do-instagram",
			expiresAt: new Date("2027-01-12T12:00:00Z"),
		});
		const raw = await db.transaction(async (tx) => {
			await tx.execute(
				sql`select set_config('app.company_id', ${ids.companyA}, true)`,
			);
			return tx
				.select({ token: instagramConnections.accessTokenEncrypted })
				.from(instagramConnections)
				.where(eq(instagramConnections.companyId, ids.companyA));
		});
		expect(raw[0]?.token).not.toContain("token-secreto");

		await repo.updateToken(ids.companyA, {
			accessToken: "renovado",
			expiresAt: new Date("2027-03-01T00:00:00Z"),
		});
		expect((await repo.findToken(ids.companyA))?.accessToken).toBe("renovado");
		expect(await repo.listConnectedCompanyIds()).toContain(ids.companyA);
		expect(await repo.listConnectedCompanyIds()).not.toContain(ids.companyB);
	});

	it("RN-015: a empresa B não vê a conexão da A, nem com um papel comum", async () => {
		await repo.saveConnection(ids.companyA, connection());
		expect(await repo.find(ids.companyB)).toBeNull();
		expect(await repo.findToken(ids.companyB)).toBeNull();

		// Superusuário ignora o RLS; um papel comum, como o do servidor em produção, não.
		await db.execute(sql`
			do $$ begin
				if not exists (select from pg_roles where rolname = 'convergia_rls_probe') then
					create role convergia_rls_probe nologin;
				end if;
			end $$`);
		await db.execute(sql`grant usage on schema public to convergia_rls_probe`);
		await db.execute(
			sql`grant select on instagram_connections to convergia_rls_probe`,
		);
		const readAs = (companyId: string) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`set local role convergia_rls_probe`);
				await tx.execute(
					sql`select set_config('app.company_id', ${companyId}, true)`,
				);
				return tx
					.select({ id: instagramConnections.companyId })
					.from(instagramConnections)
					.where(eq(instagramConnections.companyId, ids.companyA));
			});
		expect(await readAs(ids.companyA)).toHaveLength(1);
		expect(await readAs(ids.companyB)).toEqual([]);
	});
});
