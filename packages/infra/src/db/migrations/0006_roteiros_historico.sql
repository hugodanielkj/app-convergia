-- RN-072, RN-231: o histórico guarda se a geração foi da agência ou do cliente.
-- As linhas antigas recebem o tipo do usuário que gerou. O dono da tabela passa pelo RLS
-- (0004, 0005), então o FORCE sai só durante o preenchimento.
ALTER TABLE "content_generations" ADD COLUMN "created_by_kind" "creator_kind";--> statement-breakpoint
ALTER TABLE "content_option_sets" ADD COLUMN "created_by_kind" "creator_kind";--> statement-breakpoint
ALTER TABLE "content_generations" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_option_sets" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "content_generations" AS g SET "created_by_kind" = CASE u."kind" WHEN 'agency_member' THEN 'agency'::"creator_kind" ELSE 'client'::"creator_kind" END FROM "users" AS u WHERE u."id" = g."created_by_user_id";--> statement-breakpoint
UPDATE "content_option_sets" AS o SET "created_by_kind" = CASE u."kind" WHEN 'agency_member' THEN 'agency'::"creator_kind" ELSE 'client'::"creator_kind" END FROM "users" AS u WHERE u."id" = o."created_by_user_id";--> statement-breakpoint
ALTER TABLE "content_generations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_option_sets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_generations" ALTER COLUMN "created_by_kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "content_option_sets" ALTER COLUMN "created_by_kind" SET NOT NULL;
