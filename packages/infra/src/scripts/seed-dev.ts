import { loadEnv } from "@convergia/config";
import { issueApiKey } from "@convergia/core";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../db/client";
import { createApiKeyRepository } from "../db/repositories/api-key.repository";
import { agencies, companies, users } from "../db/schema";

/**
 * Dados de desenvolvimento e uma chave de API nova para cada usuário de exemplo.
 * Até existirem as telas Empresas e Conta do app web (RN-026, RN-025), é o único
 * jeito de conseguir uma chave. Só roda contra o Postgres local.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const env = loadEnv();
const host = new URL(env.DATABASE_URL).hostname;
if (env.NODE_ENV === "production" || !LOCAL_HOSTS.has(host)) {
	console.error("db:seed só roda contra o Postgres local.");
	process.exit(1);
}

const AGENCY_NAME = "Agência de desenvolvimento";
const COMPANY_NAME = "Empresa de exemplo";

async function findOrCreateAgency(db: Db): Promise<string> {
	const [existing] = await db
		.select({ id: agencies.id })
		.from(agencies)
		.where(eq(agencies.name, AGENCY_NAME))
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(agencies)
		.values({ name: AGENCY_NAME })
		.returning({ id: agencies.id });
	if (!created) throw new Error("Agência não foi criada.");
	return created.id;
}

async function findOrCreateCompany(db: Db, agencyId: string): Promise<string> {
	const [existing] = await db
		.select({ id: companies.id })
		.from(companies)
		.where(eq(companies.name, COMPANY_NAME))
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(companies)
		.values({ agencyId, name: COMPANY_NAME })
		.returning({ id: companies.id });
	if (!created) throw new Error("Empresa não foi criada.");
	return created.id;
}

async function findOrCreateUser(
	db: Db,
	user: typeof users.$inferInsert,
): Promise<string> {
	const [row] = await db
		.insert(users)
		.values(user)
		.onConflictDoUpdate({ target: users.email, set: { name: user.name } })
		.returning({ id: users.id });
	if (!row) throw new Error(`Usuário ${user.email} não foi criado.`);
	return row.id;
}

const db = createDb(env.DATABASE_URL);
try {
	const apiKeys = createApiKeyRepository(db);
	const agencyId = await findOrCreateAgency(db);
	const companyId = await findOrCreateCompany(db, agencyId);
	const people = [
		{
			label: "Usuário do cliente",
			email: "cliente@exemplo.test",
			id: await findOrCreateUser(db, {
				agencyId,
				companyId,
				kind: "client_user",
				name: "Cliente de exemplo",
				email: "cliente@exemplo.test",
			}),
		},
		{
			label: "Membro da agência",
			email: "agencia@exemplo.test",
			id: await findOrCreateUser(db, {
				agencyId,
				kind: "agency_member",
				name: "Membro de exemplo",
				email: "agencia@exemplo.test",
			}),
		},
	];

	console.log("Chaves de API de desenvolvimento (aparecem só agora):\n");
	for (const person of people) {
		const { token } = await issueApiKey(
			{ apiKeys },
			{ userId: person.id, name: "db:seed", scopes: ["read", "write"] },
		);
		console.log(`${person.label} (${person.email}):\n  ${token}\n`);
	}
} finally {
	await db.$client.end();
}
