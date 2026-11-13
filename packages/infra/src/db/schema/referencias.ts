import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
