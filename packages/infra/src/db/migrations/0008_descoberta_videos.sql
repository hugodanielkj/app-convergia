CREATE TYPE "public"."video_platform" AS ENUM('instagram', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."video_query_status" AS ENUM('queued', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "discovered_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "video_platform" NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"creator_handle" text,
	"creator_name" text,
	"thumbnail_url" text,
	"published_at" timestamp with time zone,
	"duration_seconds" real,
	"language" text,
	"views" bigint,
	"likes" bigint,
	"comments" bigint,
	"shares" bigint,
	"metrics_observed_at" timestamp with time zone,
	"source" text NOT NULL,
	"first_collected_at" timestamp with time zone NOT NULL,
	"last_collected_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_metric_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"views" bigint,
	"likes" bigint,
	"comments" bigint,
	"shares" bigint,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_provider_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"platform" "video_platform" NOT NULL,
	"operation" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"attempts" integer NOT NULL,
	"success" boolean NOT NULL,
	"error_kind" text,
	"credits" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"query_text" text NOT NULL,
	"platforms" jsonb NOT NULL,
	"period" text NOT NULL,
	"status" "video_query_status" DEFAULT 'queued' NOT NULL,
	"progress" jsonb,
	"platform_outcomes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requested_by_company_id" uuid NOT NULL,
	"pending_reservations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_queries_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "video_query_results" (
	"query_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"match_score" real NOT NULL,
	"provider_rank" integer NOT NULL,
	CONSTRAINT "video_query_results_query_id_video_id_pk" PRIMARY KEY("query_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "video_search_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"query_id" uuid NOT NULL,
	"cache_status" text NOT NULL,
	"quota_day" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_search_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "video_metric_observations" ADD CONSTRAINT "video_metric_observations_video_id_discovered_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."discovered_videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_queries" ADD CONSTRAINT "video_queries_requested_by_company_id_companies_id_fk" FOREIGN KEY ("requested_by_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_query_results" ADD CONSTRAINT "video_query_results_query_id_video_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."video_queries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_query_results" ADD CONSTRAINT "video_query_results_video_id_discovered_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."discovered_videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_search_requests" ADD CONSTRAINT "video_search_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_search_requests" ADD CONSTRAINT "video_search_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_search_requests" ADD CONSTRAINT "video_search_requests_query_id_video_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."video_queries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discovered_videos_platform_external_idx" ON "discovered_videos" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "video_metric_observations_video_idx" ON "video_metric_observations" USING btree ("video_id","observed_at");--> statement-breakpoint
CREATE INDEX "video_provider_calls_created_idx" ON "video_provider_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "video_search_requests_user_idx" ON "video_search_requests" USING btree ("company_id","user_id","created_at");--> statement-breakpoint
CREATE POLICY "video_search_requests_company_isolation" ON "video_search_requests" AS PERMISSIVE FOR ALL TO public USING ("video_search_requests"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("video_search_requests"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
-- O dono das tabelas também passa pelo RLS (RN-015), como em 0004_roteiros_rls_force.
ALTER TABLE "video_search_requests" FORCE ROW LEVEL SECURITY;
