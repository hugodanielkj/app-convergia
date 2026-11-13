import { attachContentReference, attachmentInput } from "@convergia/core";
import { z } from "zod";
import { registerCompanyTool } from "../company-tool";
import type { RegisterKnowledgeTool } from "./deps";
export const registerAttachContentReference: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"attach_content_reference",
		{
			title: "Anexar referência",
			description:
				"Anexa post, criador, link ou documento ao card, sem IA nem análise e sem alterar a aprovação.",
			input: {
				content_id: z.string().describe("ID do card"),
				...attachmentInput.shape,
			},
			readOnly: false,
		},
		async (actor, input) => {
			const result = await attachContentReference(
				deps,
				actor,
				input.content_id,
				input,
			);
			return {
				content: [
					{ type: "text", text: JSON.stringify(result ?? { ok: true }) },
				],
				structuredContent: {
					result: JSON.parse(JSON.stringify(result ?? { ok: true })),
				},
			};
		},
	);
