import {
	APPROVAL_STATUSES,
	type Citation,
	FUNNEL_STAGES,
	KANBAN_STATUSES,
	MEDIA_TYPES,
} from "@convergia/core";
import { sql } from "drizzle-orm";
import {
	check,
	date,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./acesso";

export const kanbanStatus = pgEnum("kanban_status", KANBAN_STATUSES);
export const mediaType = pgEnum("media_type", MEDIA_TYPES);
export const funnelStage = pgEnum("funnel_stage", FUNNEL_STAGES);
export const approvalStatus = pgEnum("approval_status", APPROVAL_STATUSES);
export const creatorKind = pgEnum("creator_kind", ["agency", "client"]);

/** Empresa da transação atual (ver `withCompany`); sem ela, o RLS não mostra nenhuma linha. */
const currentCompany = sql`nullif(current_setting('app.company_id', true), '')::uuid`;

/** Cards (RN-060). Isolados por empresa no código e no RLS (RN-015). */
export const contents = pgTable(
	"contents",
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
		idea: text("idea"),
		scriptHook: text("script_hook"),
		scriptBody: text("script_body"),
		scriptCta: text("script_cta"),
		scriptCaption: text("script_caption"),
		/** 📎 RN-075: fontes do roteiro, vindas de prévias aplicadas. */
		citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
		platform: text("platform").notNull().default("instagram"),
		mediaType: mediaType("media_type"),
		format: text("format"),
		category: text("category"),
		funnelStage: funnelStage("funnel_stage"),
		targetDurationSeconds: integer("target_duration_seconds"),
		status: kanbanStatus("status").notNull().default("idea"),
		position: doublePrecision("position").notNull(),
		plannedDate: date("planned_date", { mode: "string" }),
		contentVersion: integer("content_version").notNull().default(1),
		approvalStatus: approvalStatus("approval_status").notNull(),
		/**
		 * Solicitação de aprovação vigente (design §5.2). Sem chave estrangeira para não criar
		 * dependência circular entre as tabelas; quem grava é o repositório de aprovações.
		 */
		currentApprovalRequestId: uuid("current_approval_request_id"),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("contents_company_status_position_idx").on(
			table.companyId,
			table.status,
			table.position,
		),
		index("contents_company_planned_date_idx").on(
			table.companyId,
			table.plannedDate,
		),
		check("contents_platform_instagram", sql`${table.platform} = 'instagram'`),
		pgPolicy("contents_company_isolation", {
			for: "all",
			using: sql`${table.companyId} = ${currentCompany}`,
			withCheck: sql`${table.companyId} = ${currentCompany}`,
		}),
	],
).enableRLS();
