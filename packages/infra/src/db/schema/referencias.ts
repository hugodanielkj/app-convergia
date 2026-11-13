import type {
	ReferenceEvidence,
	ReferenceOperation,
	ReferenceQuotaTool,
} from "@convergia/core";
import {
	date,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./acesso";
import { companyIsolation } from "./company-scope";
import { contents } from "./conteudo";
export const savedReferences = pgTable(
	"saved_references",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		url: text("url").notNull(),
		kind: text("kind", { enum: ["post", "creator"] }).notNull(),
		status: text("status", { enum: ["queued", "ready", "failed"] }).notNull(),
		text: text("text"),
		analysis: text("analysis"),
		error: text("error"),
		evidence: jsonb("evidence").$type<ReferenceEvidence>(),
		summary: text("summary"),
		analysisStatus: text("analysis_status", {
			enum: ["none", "queued", "ready", "failed"],
		})
			.notNull()
			.default("none"),
	},
	(t) => [
		uniqueIndex("saved_references_company_url_idx").on(t.companyId, t.url),
		companyIsolation("saved_references_isolation", t.companyId),
	],
).enableRLS();
export const cardReferences = pgTable(
	"card_references",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		contentId: uuid("content_id")
			.notNull()
			.references(() => contents.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		url: text("url").notNull(),
		kind: text("kind", {
			enum: ["post", "creator", "link", "document"],
		}).notNull(),
	},
	(t) => [
		index("card_references_company_content_idx").on(t.companyId, t.contentId),
		companyIsolation("card_references_isolation", t.companyId),
	],
).enableRLS();

export const referenceJobs = pgTable(
	"reference_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		referenceId: uuid("reference_id")
			.notNull()
			.references(() => savedReferences.id, { onDelete: "cascade" }),
		operation: text("operation").$type<ReferenceOperation>().notNull(),
		status: text("status", { enum: ["queued", "running", "ready", "failed"] })
			.notNull()
			.default("queued"),
		quotaDay: date("quota_day").notNull(),
		quotaTool: text("quota_tool").$type<ReferenceQuotaTool>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		startedAt: timestamp("started_at", { withTimezone: true }),
	},
	(t) => [
		index("reference_jobs_status_idx").on(t.status, t.createdAt),
		companyIsolation("reference_jobs_isolation", t.companyId),
	],
).enableRLS();
