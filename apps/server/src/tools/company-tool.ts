import type {
	ActorContext,
	AuthenticatedUser,
	CompanyRepository,
} from "@convergia/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { withMcpErrors } from "../errors/to-mcp-result";
import { actorFor, companyIdInput } from "./company-input";

/**
 * Registra uma ferramenta que opera dentro de uma empresa (RN-022): acrescenta `company_id`
 * para o membro da agência, monta o contexto do ator e trata os erros de negócio.
 */
export function registerCompanyTool<Shape extends z.ZodRawShape>(
	server: McpServer,
	user: AuthenticatedUser,
	deps: { companies: CompanyRepository },
	name: string,
	config: {
		title: string;
		description: string;
		input: Shape;
		readOnly?: boolean;
	},
	run: (
		actor: ActorContext,
		input: z.infer<z.ZodObject<Shape>>,
	) => Promise<CallToolResult>,
): void {
	const inputSchema: z.ZodRawShape = {
		...companyIdInput(user),
		...config.input,
	};
	const companyArg = z.object({ company_id: z.string().optional() });
	server.registerTool(
		name,
		{
			title: config.title,
			description: config.description,
			inputSchema,
			annotations: { readOnlyHint: config.readOnly ?? false },
		},
		(args: Record<string, unknown>) =>
			withMcpErrors(async () => {
				const { company_id } = companyArg.parse(args);
				const actor = await actorFor(
					deps,
					user,
					company_id === undefined ? {} : { company_id },
				);
				return run(actor, z.object(config.input).parse(args));
			}),
	);
}
