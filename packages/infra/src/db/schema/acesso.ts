import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const userKind = pgEnum("user_kind", ["agency_member", "client_user"]);

export const apiKeyScope = pgEnum("api_key_scope", ["read", "write"]);

export const agencies = pgTable("agencies", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	createdAt: createdAt(),
});

export const companies = pgTable(
	"companies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		agencyId: uuid("agency_id")
			.notNull()
			.references(() => agencies.id),
		name: text("name").notNull(),
		createdAt: createdAt(),
	},
	(table) => [index("companies_agency_id_idx").on(table.agencyId)],
);

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		agencyId: uuid("agency_id")
			.notNull()
			.references(() => agencies.id),
		// Só o usuário do cliente pertence a uma empresa (RN-015).
		companyId: uuid("company_id").references(() => companies.id),
		kind: userKind("kind").notNull(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		createdAt: createdAt(),
	},
	(table) => [
		check(
			"users_company_matches_kind",
			sql`(${table.kind} = 'client_user') = (${table.companyId} is not null)`,
		),
		// RN-016: no protótipo, cada empresa cliente tem exatamente um usuário.
		uniqueIndex("users_one_client_user_per_company")
			.on(table.companyId)
			.where(sql`${table.kind} = 'client_user'`),
	],
);

/** Chaves de API (RN-023, RN-025). A chave nunca é gravada; só o hash SHA-256. */
export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		name: text("name").notNull(),
		keyHash: text("key_hash").notNull().unique(),
		scopes: apiKeyScope("scopes").array().notNull(),
		createdAt: createdAt(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(table) => [
		index("api_keys_user_id_idx").on(table.userId),
		check("api_keys_scopes_not_empty", sql`cardinality(${table.scopes}) > 0`),
	],
);
