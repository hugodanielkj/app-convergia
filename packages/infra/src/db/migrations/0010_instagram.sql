CREATE TABLE "instagram_connect_requests" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"expected_username" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_connections" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"ig_user_id" text NOT NULL,
	"username" text NOT NULL,
	"connected_by_user_id" uuid NOT NULL,
	"connected_at" timestamp with time zone NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"snapshot" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instagram_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instagram_connect_requests" ADD CONSTRAINT "instagram_connect_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_connect_requests" ADD CONSTRAINT "instagram_connect_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_connections" ADD CONSTRAINT "instagram_connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_connections" ADD CONSTRAINT "instagram_connections_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "instagram_connections_company_isolation" ON "instagram_connections" AS PERMISSIVE FOR ALL TO public USING ("instagram_connections"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("instagram_connections"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
-- O dono da tabela também passa pelo RLS (RN-015), como em 0004_roteiros_rls_force.
ALTER TABLE "instagram_connections" FORCE ROW LEVEL SECURITY;
