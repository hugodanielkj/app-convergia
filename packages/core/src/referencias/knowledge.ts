import { z } from "zod";
export const referenceInput = z.object({
	url: z.url().refine((value) => {
		const u = new URL(value);
		return (
			u.protocol === "https:" &&
			["instagram.com", "www.instagram.com"].includes(u.hostname) &&
			!u.username &&
			!u.password &&
			!u.port &&
			u.pathname !== "/"
		);
	}, "Informe um link público de post ou perfil do Instagram."),
});
export const attachmentInput = z.object({
	title: z.string().trim().min(1).max(200),
	url: z.url({ protocol: /^https?$/ }),
	kind: z.enum(["post", "creator", "link", "document"]),
});
export type CardReference = z.infer<typeof attachmentInput> & {
	id: string;
	companyId: string;
	contentId: string;
};
export type SavedReference = {
	id: string;
	companyId: string;
	url: string;
	kind: "post" | "creator";
	status: "queued" | "ready" | "failed";
	text: string | null;
	analysis: string | null;
	error: string | null;
};
export interface KnowledgeRepository {
	listSaved(companyId: string): Promise<SavedReference[]>;
	findSaved(companyId: string, id: string): Promise<SavedReference | null>;
	deleteSaved(companyId: string, id: string): Promise<boolean>;
	listAttached(companyId: string, contentId: string): Promise<CardReference[]>;
	attach(
		companyId: string,
		contentId: string,
		input: z.infer<typeof attachmentInput>,
	): Promise<CardReference>;
	detach(companyId: string, contentId: string, id: string): Promise<boolean>;
}
