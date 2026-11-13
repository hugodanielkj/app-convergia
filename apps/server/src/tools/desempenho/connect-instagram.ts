import {
	connectInstagramInput,
	startInstagramConnection,
} from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterInstagramTool } from "./deps";

/** ✅ RN-034, RN-035: só o usuário do cliente conecta, pela autenticação da Meta. */
export const registerConnectInstagram: RegisterInstagramTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"connect_instagram",
		{
			title: "Conectar o Instagram",
			description:
				"Gera o link para conectar o Instagram da empresa pela autenticação da Meta. Informe o @ da empresa; a conta precisa ser Profissional (comercial ou de criador). Abra o link no navegador e entre com essa conta.",
			input: { username: connectInstagramInput.shape.username },
		},
		async (actor, input) => {
			const { authorizeUrl } = await startInstagramConnection(deps, actor, {
				username: input.username,
			});
			return {
				content: [
					{
						type: "text",
						text: `Abra este link no navegador e entre com @${input.username} (vale por 15 minutos):\n${authorizeUrl}`,
					},
				],
				structuredContent: { authorizeUrl },
			};
		},
	);
