CREATE TABLE "card_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_references" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saved_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"text" text,
	"analysis" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "saved_references" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"text" text,
	"url" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "content_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_references" ADD CONSTRAINT "card_references_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_references" ADD CONSTRAINT "card_references_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_references" ADD CONSTRAINT "saved_references_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_references_company_content_idx" ON "card_references" USING btree ("company_id","content_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_references_company_url_idx" ON "saved_references" USING btree ("company_id","url");--> statement-breakpoint
CREATE INDEX "content_sources_company_content_idx" ON "content_sources" USING btree ("company_id","content_id");--> statement-breakpoint
CREATE POLICY "card_references_isolation" ON "card_references" AS PERMISSIVE FOR ALL TO public USING ("card_references"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("card_references"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "saved_references_isolation" ON "saved_references" AS PERMISSIVE FOR ALL TO public USING ("saved_references"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("saved_references"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "content_sources_isolation" ON "content_sources" AS PERMISSIVE FOR ALL TO public USING ("content_sources"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("content_sources"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "saved_references" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_references" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "content_sources" FORCE ROW LEVEL SECURITY;
