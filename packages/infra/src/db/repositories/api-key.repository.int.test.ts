import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import { hashApiKey, issueApiKey } from "@convergia/core";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { agencies, apiKeys, companies, users } from "../schema";
import { createApiKeyRepository } from "./api-key.repository";

describe("repositório de chaves de API", () => {
	const db = createDb(loadEnv().DATABASE_URL);
	const repository = createApiKeyRepository(db);
	const run = randomUUID();
	let agencyId = "";
	let companyId = "";
	let clientUserId = "";
	let agencyMemberId = "";

	beforeAll(async () => {
		const [agency] = await db
			.insert(agencies)
			.values({ name: `Agência ${run}` })
			.returning();
		agencyId = agency?.id ?? "";
		const [company] = await db
			.insert(companies)
			.values({ agencyId, name: `Empresa ${run}` })
			.returning();
		companyId = company?.id ?? "";
		const inserted = await db
			.insert(users)
			.values([
				{
					agencyId,
					companyId,
					kind: "client_user",
					name: "Cliente de teste",
					email: `cliente-${run}@exemplo.test`,
				},
				{
					agencyId,
					kind: "agency_member",
					name: "Membro de teste",
					email: `agencia-${run}@exemplo.test`,
				},
			])
			.returning();
		clientUserId = inserted[0]?.id ?? "";
		agencyMemberId = inserted[1]?.id ?? "";
	});

	afterAll(async () => {
		const userIds = [clientUserId, agencyMemberId];
		await db.delete(apiKeys).where(inArray(apiKeys.userId, userIds));
		await db.delete(users).where(inArray(users.id, userIds));
		await db.delete(companies).where(eq(companies.id, companyId));
		await db.delete(agencies).where(eq(agencies.id, agencyId));
		await db.$client.end();
	});

	it("RN-023: encontra o usuário do cliente, com a empresa e as permissões da chave", async () => {
		const { token } = await issueApiKey(
			{ apiKeys: repository },
			{ userId: clientUserId, name: "Cursor", scopes: ["read", "write"] },
		);

		expect(
			await repository.findActiveOwnerByHash(await hashApiKey(token)),
		).toEqual({
			kind: "client_user",
			userId: clientUserId,
			agencyId,
			companyId,
			scopes: ["read", "write"],
		});
	});

	it("RN-023: encontra o membro da agência, sem empresa fixa", async () => {
		const { token } = await issueApiKey(
			{ apiKeys: repository },
			{ userId: agencyMemberId, name: "Claude Code", scopes: ["read"] },
		);

		expect(
			await repository.findActiveOwnerByHash(await hashApiKey(token)),
		).toEqual({
			kind: "agency_member",
			userId: agencyMemberId,
			agencyId,
			scopes: ["read"],
		});
	});

	it("RN-025: chave revogada não é encontrada nem conta no limite", async () => {
		const before = await repository.countActiveByUser(clientUserId);
		const { id, token } = await issueApiKey(
			{ apiKeys: repository },
			{ userId: clientUserId, name: "Revogada", scopes: ["read"] },
		);
		expect(await repository.countActiveByUser(clientUserId)).toBe(before + 1);

		await db
			.update(apiKeys)
			.set({ revokedAt: new Date() })
			.where(eq(apiKeys.id, id));

		expect(
			await repository.findActiveOwnerByHash(await hashApiKey(token)),
		).toBeNull();
		expect(await repository.countActiveByUser(clientUserId)).toBe(before);
	});

	it("grava só o hash da chave", async () => {
		const { id, token } = await issueApiKey(
			{ apiKeys: repository },
			{ userId: clientUserId, name: "Hash", scopes: ["read"] },
		);
		const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));

		expect(row?.keyHash).toBe(await hashApiKey(token));
		expect(JSON.stringify(row)).not.toContain(token);
	});

	it("RN-016: a empresa não aceita um segundo usuário do cliente", async () => {
		await expect(
			db.insert(users).values({
				agencyId,
				companyId,
				kind: "client_user",
				name: "Outro cliente",
				email: `outro-${run}@exemplo.test`,
			}),
		).rejects.toThrow();
	});

	it("usuário do cliente sem empresa é recusado pelo banco", async () => {
		await expect(
			db.insert(users).values({
				agencyId,
				kind: "client_user",
				name: "Sem empresa",
				email: `sem-empresa-${run}@exemplo.test`,
			}),
		).rejects.toThrow();
	});
});
