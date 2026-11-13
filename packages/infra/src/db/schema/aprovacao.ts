import {
	APPROVAL_EVENT_TYPES,
	APPROVAL_ITEM_TYPES,
	APPROVAL_REQUEST_STATUSES,
	type Script,
} from "@convergia/core";
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./acesso";
import { companyIsolation } from "./company-scope";
import { contents, creatorKind } from "./conteudo";
import { ideas } from "./ideias";

export const approvalItemType = pgEnum(
	"approval_item_type",
	APPROVAL_ITEM_TYPES,
);
export const approvalRequestStatus = pgEnum(
	"approval_request_status",
	APPROVAL_REQUEST_STATUSES,
);
export const approvalEventType = pgEnum(
	"approval_event_type",
	APPROVAL_EVENT_TYPES,
);

/** Envios para aprovação e a decisão sobre cada um (design §5.3). */
export const approvalRequests = pgTable(
	"approval_requests",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		contentId: uuid("content_id").references(() => contents.id),
		ideaId: uuid("idea_id").references(() => ideas.id),
		itemType: approvalItemType("item_type").notNull(),
		submittedVersion: integer("submitted_version").notNull(),
		itemVersion: integer("item_version").notNull(),
		snapshot: jsonb("snapshot").$type<Script>().notNull(),
		status: approvalRequestStatus("status").notNull(),
		submittedBy: uuid("submitted_by")
			.notNull()
			.references(() => users.id),
		submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
		decidedBy: uuid("decided_by").references(() => users.id),
		decidedAt: timestamp("decided_at", { withTimezone: true }),
		decidedOnBehalf: boolean("decided_on_behalf").notNull().default(false),
		reason: text("reason"),
	},
	(table) => [
		check(
			"approval_requests_target",
			sql`(${table.contentId} IS NOT NULL AND ${table.ideaId} IS NULL AND ${table.itemType}::text = 'script') OR (${table.contentId} IS NULL AND ${table.ideaId} IS NOT NULL AND ${table.itemType}::text = 'idea')`,
		),
		uniqueIndex("approval_ideas_one_pending_idx")
			.on(table.ideaId)
			.where(sql`${table.status} = 'pending'`),
		index("approval_requests_company_content_idx").on(
			table.companyId,
			table.contentId,
			table.submittedAt,
		),
		// Um roteiro tem no máximo um envio pendente por vez.
		uniqueIndex("approval_requests_one_pending_idx")
			.on(table.contentId)
			.where(sql`${table.status} = 'pending'`),
		companyIsolation("approval_requests_company_isolation", table.companyId),
	],
).enableRLS();

/** ✅ RN-230: histórico de envios, edições na pendência, decisões e perdas de aprovação. */
export const approvalEvents = pgTable(
	"approval_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		companyId: uuid("company_id")
			.notNull()
			.references(() => companies.id),
		requestId: uuid("request_id")
			.notNull()
			.references(() => approvalRequests.id),
		contentId: uuid("content_id").references(() => contents.id),
		ideaId: uuid("idea_id").references(() => ideas.id),
		type: approvalEventType("type").notNull(),
		actorId: uuid("actor_id")
			.notNull()
			.references(() => users.id),
		actorKind: creatorKind("actor_kind").notNull(),
		itemVersion: integer("item_version").notNull(),
		reason: text("reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"approval_events_target",
			sql`num_nonnulls(${table.contentId}, ${table.ideaId}) = 1`,
		),
		index("approval_events_company_content_idx").on(
			table.companyId,
			table.contentId,
			table.createdAt,
		),
		companyIsolation("approval_events_company_isolation", table.companyId),
	],
).enableRLS();
