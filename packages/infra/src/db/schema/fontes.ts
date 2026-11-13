import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { companies } from "./acesso";
import { companyIsolation } from "./company-scope";
import { contents } from "./conteudo";
export const contentSources = pgTable(
	"content_sources",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		contentId: uuid("content_id")
			.notNull()
			.references(() => contents.id, { onDelete: "cascade" }),
		kind: text("kind", { enum: ["text", "url", "pdf"] }).notNull(),
		status: text("status", { enum: ["queued", "ready", "failed"] }).notNull(),
		text: text("text"),
		url: text("url"),
		error: text("error"),
	},
	(t) => [
		index("content_sources_company_content_idx").on(t.companyId, t.contentId),
		companyIsolation("content_sources_isolation", t.companyId),
	],
).enableRLS();
