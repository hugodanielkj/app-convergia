import { SCRIPT_FIELDS, type Script } from "@convergia/core";
import {
	bigint,
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./acesso";
import { companyIsolation } from "./company-scope";
import { contents } from "./conteudo";

const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** 📎 RN-072: cada roteiro gerado fica no histórico do card. */
export const contentGenerations = pgTable(
	"content_generations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		contentId: uuid("content_id")
			.notNull()
			.references(() => contents.id),
		script: jsonb("script").$type<Script>().notNull(),
		createdByUserId: uuid("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt: createdAt(),
	},
	(table) => [
		index("content_generations_company_content_idx").on(
			table.companyId,
			table.contentId,
			table.createdAt,
		),
		companyIsolation("content_generations_company_isolation", table.companyId),
	],
).enableRLS();

export const scriptField = pgEnum("script_field", SCRIPT_FIELDS);

/** 📎 RN-072: as opções avulsas (RN-071) também ficam no histórico do card. */
export const contentOptionSets = pgTable(
	"content_option_sets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		contentId: uuid("content_id")
			.notNull()
			.references(() => contents.id),
		field: scriptField("field").notNull(),
		options: jsonb("options").$type<string[]>().notNull(),
		createdByUserId: uuid("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt: createdAt(),
	},
	(table) => [
		index("content_option_sets_company_content_idx").on(
			table.companyId,
			table.contentId,
			table.createdAt,
		),
		companyIsolation("content_option_sets_company_isolation", table.companyId),
	],
).enableRLS();

export const refineRole = pgEnum("refine_role", ["user", "assistant"]);
export const previewStatus = pgEnum("preview_status", [
	"pending",
	"applied",
	"discarded",
]);

/** Conversa de refino de um card (✅ RN-006). A resposta da IA guarda a prévia (📎 RN-073). */
export const refineMessages = pgTable(
	"refine_messages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Ordem estável: pedido e resposta são gravados juntos, no mesmo instante.
		seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		contentId: uuid("content_id")
			.notNull()
			.references(() => contents.id),
		role: refineRole("role").notNull(),
		text: text("text").notNull(),
		preview: jsonb("preview").$type<Script>(),
		previewBaseVersion: integer("preview_base_version"),
		previewStatus: previewStatus("preview_status"),
		createdByUserId: uuid("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt: createdAt(),
	},
	(table) => [
		index("refine_messages_company_content_seq_idx").on(
			table.companyId,
			table.contentId,
			table.seq,
		),
		companyIsolation("refine_messages_company_isolation", table.companyId),
	],
).enableRLS();

/** Uso da cota por empresa, ferramenta e dia em São Paulo (RN-301, RN-304; design §5.4). */
export const quotaUsage = pgTable(
	"quota_usage",
	{
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		toolKey: text("tool_key").notNull(),
		day: date("day", { mode: "string" }).notNull(),
		used: integer("used").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.companyId, table.toolKey, table.day] }),
		companyIsolation("quota_usage_company_isolation", table.companyId),
	],
).enableRLS();

/** Toda chamada de IA, para medir custo por empresa (design §10). */
export const aiCallLog = pgTable(
	"ai_call_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		tool: text("tool").notNull(),
		model: text("model").notNull(),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		durationMs: integer("duration_ms").notNull(),
		success: boolean("success").notNull(),
		error: text("error"),
		createdAt: createdAt(),
	},
	(table) => [
		index("ai_call_log_company_created_idx").on(
			table.companyId,
			table.createdAt,
		),
		companyIsolation("ai_call_log_company_isolation", table.companyId),
	],
).enableRLS();
