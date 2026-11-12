import { randomUUID } from "node:crypto";
import { loadEnv } from "@convergia/config";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { agencies, companies } from "../schema";
import { createCompanyRepository } from "./company.repository";

describe("repositório de empresas", () => {
	const db = createDb(loadEnv().DATABASE_URL);
	const repository = createCompanyRepository(db);
	const run = randomUUID();
	const agencyIds: string[] = [];
	const ids = { agency: "", otherAgency: "", alpha: "", beta: "", foreign: "" };

	beforeAll(async () => {
		const createdAgencies = await db
			.insert(agencies)
			.values([{ name: `Agência ${run}` }, { name: `Outra agência ${run}` }])
			.returning();
		ids.agency = createdAgencies[0]?.id ?? "";
		ids.otherAgency = createdAgencies[1]?.id ?? "";
		agencyIds.push(ids.agency, ids.otherAgency);
		const created = await db
			.insert(companies)
			.values([
				{ agencyId: ids.agency, name: "Beta" },
				{ agencyId: ids.agency, name: "Alfa" },
				{ agencyId: ids.otherAgency, name: "Estrangeira" },
			])
			.returning();
		ids.beta = created[0]?.id ?? "";
		ids.alpha = created[1]?.id ?? "";
		ids.foreign = created[2]?.id ?? "";
	});

	afterAll(async () => {
		await db.delete(companies).where(inArray(companies.agencyId, agencyIds));
		await db.delete(agencies).where(inArray(agencies.id, agencyIds));
		await db.$client.end();
	});

	it("RN-010: lista só as empresas da agência, por nome", async () => {
		expect(await repository.listByAgency(ids.agency)).toEqual([
			{ id: ids.alpha, agencyId: ids.agency, name: "Alfa" },
			{ id: ids.beta, agencyId: ids.agency, name: "Beta" },
		]);
	});

	it("encontra a empresa dentro da agência", async () => {
		expect(await repository.findInAgency(ids.beta, ids.agency)).toEqual({
			id: ids.beta,
			agencyId: ids.agency,
			name: "Beta",
		});
	});

	it("RN-015: não encontra empresa de outra agência", async () => {
		expect(await repository.findInAgency(ids.foreign, ids.agency)).toBeNull();
	});

	it("company_id fora do formato UUID não chega ao banco", async () => {
		expect(
			await repository.findInAgency("'; drop table companies; --", ids.agency),
		).toBeNull();
	});
});
