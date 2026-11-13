ALTER TABLE "contents" ADD COLUMN "citations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "refine_messages" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;