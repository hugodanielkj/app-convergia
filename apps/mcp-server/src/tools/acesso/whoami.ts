import { type ActorContext, whoami } from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withMcpErrors } from "../../errors/to-mcp-result";

const KIND_LABEL: Record<ActorContext["kind"], string> = {
	agency_member: "membro da agência",
	client_user: "usuário do cliente",
};

const SCOPE_LABEL: Record<ActorContext["scopes"][number], string> = {
	read: "leitura",
	write: "escrita",
};

export function registerWhoami(server: McpServer, actor: ActorContext): void {
	server.registerTool(
		"whoami",
		{
			title: "Quem sou eu",
			description:
				"Mostra quem está conectado, o papel (membro da agência ou usuário do cliente), a empresa em que está operando e as permissões da conexão. Não consome cota.",
			annotations: { readOnlyHint: true },
		},
		() =>
			withMcpErrors(() => {
				const result = whoami(actor);
				const scopes = result.scopes
					.map((scope) => SCOPE_LABEL[scope])
					.join(" e ");
				return {
					content: [
						{
							type: "text",
							text: `Você é ${KIND_LABEL[result.kind]} (usuário ${result.userId}), operando na empresa ${result.companyId}. Permissões: ${scopes}.`,
						},
					],
					structuredContent: result,
				};
			}),
	);
}
