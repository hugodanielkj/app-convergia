import {
	type AuthenticatedUser,
	type CompanyRepository,
	listCompanies,
} from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withMcpErrors } from "../../errors/to-mcp-result";

export function registerListCompanies(
	server: McpServer,
	user: AuthenticatedUser,
	deps: { companies: CompanyRepository },
): void {
	server.registerTool(
		"list_companies",
		{
			title: "Empresas clientes",
			description:
				"Lista as empresas clientes da agência, com o ID de cada uma. Use o ID no parâmetro company_id das outras ferramentas. Não consome cota.",
			annotations: { readOnlyHint: true },
		},
		() =>
			withMcpErrors(async () => {
				const companies = (await listCompanies(deps, user)).map(
					({ id, name }) => ({ id, name }),
				);
				const text =
					companies.length === 0
						? "Nenhuma empresa cliente cadastrada."
						: companies.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n");
				return {
					content: [{ type: "text", text }],
					structuredContent: { companies },
				};
			}),
	);
}
