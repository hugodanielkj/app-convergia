import { registerConnectInstagram } from "./connect-instagram";
import type { RegisterInstagramTool } from "./deps";
import { registerGetInstagramConnection } from "./get-instagram-connection";

/** Ferramentas do Instagram (design §6, "Desempenho e insights"). Conectar é do cliente (RN-034). */
export const registerInstagramTools: RegisterInstagramTool = (
	server,
	user,
	deps,
) => {
	registerGetInstagramConnection(server, user, deps);
	if (user.kind === "client_user") registerConnectInstagram(server, user, deps);
};
