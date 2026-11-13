import {
	getInstagramConnection,
	type InstagramConnectionView,
} from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterInstagramTool } from "./deps";

const count = new Intl.NumberFormat("pt-BR");

function describeView(
	view: InstagramConnectionView,
	isAgency: boolean,
): string {
	if (view.status === "not_configured") {
		return "A conexão com o Instagram ainda não foi configurada neste ambiente.";
	}
	if (view.status === "not_connected") {
		// RN-034: só o cliente conecta.
		return isAgency
			? "O cliente ainda não conectou o Instagram desta empresa."
			: "O Instagram da empresa ainda não está conectado. Use connect_instagram.";
	}
	const { connection } = view;
	const snapshot = connection.snapshot;
	const lines = [
		`Instagram conectado: @${connection.username}${connection.simulated ? " (simulado, dados de exemplo)" : ""}`,
		snapshot &&
			`Dados lidos em ${snapshot.collectedAt.toISOString()}: ${snapshot.posts.length} posts recentes`,
		snapshot?.profile.followersCount != null &&
			`${count.format(snapshot.profile.followersCount)} seguidores`,
		snapshot?.profile.biography && `Bio: ${snapshot.profile.biography}`,
		"A IA usa o perfil, as legendas e as curtidas e comentários dos posts recentes ao gerar roteiros (RN-039).",
	];
	return lines.filter(Boolean).join("\n");
}

export const registerGetInstagramConnection: RegisterInstagramTool = (
	server,
	user,
	deps,
) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_instagram_connection",
		{
			title: "Ver conexão do Instagram",
			description:
				"Mostra se o Instagram da empresa está conectado, o @, quando os dados foram lidos e o que a IA usa deles para gerar roteiros.",
			input: {},
			readOnly: true,
		},
		async (actor) => {
			const view = await getInstagramConnection(deps, actor);
			return {
				content: [
					{
						type: "text",
						text: describeView(view, actor.kind === "agency_member"),
					},
				],
				structuredContent: JSON.parse(JSON.stringify(view)),
			};
		},
	);
