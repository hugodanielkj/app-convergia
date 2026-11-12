import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import type { ActorContext } from "@convergia/core";
import {
	createContents,
	deleteContent,
	getCalendar,
	listContents,
	listDeletedContents,
	moveContent,
	updateContent,
} from "@convergia/core";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { agencies, companies, contents, users } from "../schema";
import { createContentRepository } from "./content.repository";

describe("repositório de cards", () => {
	const db = createDb(loadEnv().DATABASE_URL);
	const deps = { contents: createContentRepository(db), now: () => new Date() };
	const run = randomUUID();
	const ids = {
		agency: "",
		companyA: "",
		companyB: "",
		clientA: "",
		clientB: "",
	};
	let actorA: ActorContext;
	let actorB: ActorContext;

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
			.values([
				{
					agencyId: ids.agency,
					companyId: ids.companyA,
					kind: "client_user",
					name: "Cliente A",
					email: `a-${run}@exemplo.test`,
				},
				{
					agencyId: ids.agency,
					companyId: ids.companyB,
					kind: "client_user",
					name: "Cliente B",
					email: `b-${run}@exemplo.test`,
				},
			])
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
	});

	afterAll(async () => {
		const companyIds = [ids.companyA, ids.companyB];
		await db.delete(contents).where(inArray(contents.companyId, companyIds));
		await db.delete(users).where(inArray(users.id, [ids.clientA, ids.clientB]));
		await db.delete(companies).where(inArray(companies.id, companyIds));
		await db.delete(agencies).where(eq(agencies.id, ids.agency));
		await db.$client.end();
	});

	it("cria, edita, move e agenda com os campos completos", async () => {
		const [card] = await createContents(deps, actorA, [
			{
				title: "Reel de lançamento",
				idea: "Mostrar o produto",
				script: { hook: "Você sabia?" },
				mediaType: "reel",
				funnelStage: "top",
				targetDurationSeconds: 30,
				plannedDate: "2026-11-20",
			},
		]);
		if (!card) throw new Error("card não criado");

		const updated = await updateContent(deps, actorA, card.id, {
			script: { body: "Corpo" },
			format: "Tutorial",
		});
		const moved = await moveContent(deps, actorA, card.id, { status: "draft" });

		expect(updated).toMatchObject({
			companyId: ids.companyA,
			createdByUserId: ids.clientA,
			script: { hook: "Você sabia?", body: "Corpo", cta: null, caption: null },
			format: "Tutorial",
			mediaType: "reel",
			contentVersion: 2,
			approvalStatus: "none",
		});
		expect(moved.status).toBe("draft");
		expect(
			(
				await getCalendar(deps, actorA, {
					from: "2026-11-01",
					to: "2026-11-30",
				})
			).map((c) => c.id),
		).toContain(card.id);
	});

	it("RN-015: a empresa B não vê nem altera os cards da A", async () => {
		const [card] = await createContents(deps, actorA, [{ title: "Só da A" }]);
		if (!card) throw new Error("card não criado");

		expect((await listContents(deps, actorB)).map((c) => c.id)).not.toContain(
			card.id,
		);
		await expect(
			updateContent(deps, actorB, card.id, { title: "x" }),
		).rejects.toThrow("Card não encontrado.");
	});

	it("RN-069: excluído vai para a lixeira", async () => {
		const [card] = await createContents(deps, actorA, [
			{ title: "Para excluir" },
		]);
		if (!card) throw new Error("card não criado");

		await deleteContent(deps, actorA, card.id);

		expect((await listContents(deps, actorA)).map((c) => c.id)).not.toContain(
			card.id,
		);
		expect(
			(await listDeletedContents(deps, actorA)).map((c) => c.id),
		).toContain(card.id);
	});

	it("ID fora do formato UUID responde como não encontrado", async () => {
		await expect(
			updateContent(deps, actorA, "nao-e-uuid", { title: "x" }),
		).rejects.toThrow("Card não encontrado.");
	});

	it("RN-015: o RLS esconde cards de outra empresa mesmo sem o filtro no código", async () => {
		await createContents(deps, actorA, [{ title: "Protegido pelo RLS" }]);
		// Superusuário ignora o RLS; um papel comum, como o do servidor em produção, não.
		await db.execute(sql`
			do $$ begin
				if not exists (select from pg_roles where rolname = 'convergia_rls_probe') then
					create role convergia_rls_probe nologin;
				end if;
			end $$`);
		await db.execute(sql`grant usage on schema public to convergia_rls_probe`);
		await db.execute(sql`grant select on contents to convergia_rls_probe`);

		const countAs = (companyId: string | null) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`set local role convergia_rls_probe`);
				if (companyId) {
					await tx.execute(
						sql`select set_config('app.company_id', ${companyId}, true)`,
					);
				}
				const result = await tx.execute<{ total: number }>(
					sql`select count(*)::int as total from contents where company_id = ${ids.companyA}`,
				);
				return result[0]?.total ?? -1;
			});

		expect(await countAs(null)).toBe(0);
		expect(await countAs(ids.companyB)).toBe(0);
		expect(await countAs(ids.companyA)).toBeGreaterThan(0);
	});
});
