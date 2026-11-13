import { z } from "zod";
export const sourceInput = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("text"),
		text: z.string().trim().min(200).max(150000),
	}),
	z.object({ kind: z.literal("url"), url: z.url({ protocol: /^https?$/ }) }),
	z.object({ kind: z.literal("pdf"), uploadId: z.string().uuid() }),
]);
export type ContentSource = {
	id: string;
	companyId: string;
	contentId: string;
	kind: "text" | "url" | "pdf";
	status: "queued" | "ready" | "failed";
	text: string | null;
	url: string | null;
	error: string | null;
};
export interface SourceRepository {
	list(companyId: string, contentId: string): Promise<ContentSource[]>;
	find(
		companyId: string,
		contentId: string,
		id: string,
	): Promise<ContentSource | null>;
}
