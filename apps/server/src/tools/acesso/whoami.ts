import { type AuthenticatedUser, whoami } from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withMcpErrors } from "../../errors/to-mcp-result";

const SCOPE_LABEL: Record<AuthenticatedUser["scopes"][number], string> = {
	read: "leitura",
	write: "escrita",
};

export function registerWhoami(
	server: McpServer,
	user: AuthenticatedUser,
): void {
	server.registerTool(
		"whoami",
		{
			title: "Quem sou eu",
			description:
				"Mostra quem está conectado, o papel (membro da agência ou usuário do cliente), a empresa e as permissões da conexão. Não consome cota.",
			annotations: { readOnlyHint: true },
		},
		() =>
			withMcpErrors(() => {
				const result = whoami(user);
				const scopes = result.scopes
					.map((scope) => SCOPE_LABEL[scope])
					.join(" e ");
				const where = result.companyId
					? `usuário do cliente (usuário ${result.userId}), operando na empresa ${result.companyId}`
					: `membro da agência (usuário ${result.userId}). Informe a empresa cliente no parâmetro company_id de cada ferramenta; use list_companies para ver as empresas`;
				return {
					content: [
						{ type: "text", text: `Você é ${where}. Permissões: ${scopes}.` },
					],
					structuredContent: result,
				};
			}),
	);
}
