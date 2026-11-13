import type { InstagramSnapshot } from "@convergia/core";
import {
	boolean,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./acesso";
import { companyIsolation } from "./company-scope";

const at = (name: string) => timestamp(name, { withTimezone: true });

/** Snapshot guardado como JSON: as datas viram texto ISO. */
export type StoredSnapshot = Omit<
	InstagramSnapshot,
	"collectedAt" | "posts"
> & {
	collectedAt: string;
	posts: (Omit<InstagramSnapshot["posts"][number], "publishedAt"> & {
		publishedAt: string | null;
	})[];
};

/**
 * Conexão do Instagram de cada empresa (RN-034, RN-035). O token fica criptografado
 * (AES-256-GCM, chave em `INSTAGRAM_TOKEN_KEY`) e nunca sai do repositório.
 */
export const instagramConnections = pgTable(
	"instagram_connections",
	{
		companyId: uuid("company_id")
			.primaryKey()
			.references(() => companies.id),
		igUserId: text("ig_user_id").notNull(),
		username: text("username").notNull(),
		connectedByUserId: uuid("connected_by_user_id")
			.notNull()
			.references(() => users.id),
		connectedAt: at("connected_at").notNull(),
		accessTokenEncrypted: text("access_token_encrypted").notNull(),
		tokenExpiresAt: at("token_expires_at").notNull(),
		simulated: boolean("simulated").notNull().default(false),
		/** ✅ RN-039: perfil e posts recentes, o contexto da marca para a IA. */
		snapshot: jsonb("snapshot").$type<StoredSnapshot>(),
		updatedAt: at("updated_at").notNull().defaultNow(),
	},
	(table) => [
		companyIsolation(
			"instagram_connections_company_isolation",
			table.companyId,
		),
	],
).enableRLS();

/**
 * Pedidos de conexão em andamento. Sem RLS: a Meta devolve o navegador sem empresa no contexto,
 * e é o `state` (guardado só como hash, de uso único e curto) que diz de quem é o pedido.
 */
export const instagramConnectRequests = pgTable("instagram_connect_requests", {
	stateHash: text("state_hash").primaryKey(),
	companyId: uuid("company_id")
		.notNull()
		.references(() => companies.id),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	expectedUsername: text("expected_username").notNull(),
	expiresAt: at("expires_at").notNull(),
});
