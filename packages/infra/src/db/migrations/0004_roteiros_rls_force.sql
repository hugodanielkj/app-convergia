-- O dono das tabelas também passa pelo RLS (RN-015), como em 0002_conteudo_rls_force.
ALTER TABLE "content_generations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refine_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quota_usage" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_call_log" FORCE ROW LEVEL SECURITY;
