import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./acesso";
import { companyIsolation } from "./company-scope";
import { approvalStatus, contents, creatorKind } from "./conteudo";
export const ideas = pgTable(
	"brainstorm_suggestions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		createdByUserId: uuid("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdByKind: creatorKind("created_by_kind").notNull(),
		title: text("title").notNull(),
		text: text("text").notNull(),
		reason: text("reason").notNull(),
		state: text("state", { enum: ["active", "added", "dismissed"] })
			.notNull()
			.default("active"),
		contentId: uuid("content_id").references(() => contents.id),
		contentVersion: integer("content_version").notNull().default(1),
		approvalStatus: approvalStatus("approval_status").notNull(),
		currentApprovalRequestId: uuid("current_approval_request_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("ideas_company_state_idx").on(t.companyId, t.state),
		companyIsolation("ideas_company_isolation", t.companyId),
	],
).enableRLS();
