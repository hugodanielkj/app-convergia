import type { InstagramConnection, InstagramSnapshot } from "../instagram";

/** Pedido de conexão em andamento, ligado ao link que o cliente abriu. */
export type ConnectRequest = {
	companyId: string;
	userId: string;
	expectedUsername: string;
};

/**
 * Conexão do Instagram por empresa (RN-015). O token fica criptografado no banco e só sai daqui
 * para chamar a Meta.
 */
export interface InstagramRepository {
	/**
	 * Pedidos de conexão ficam fora do RLS: a Meta devolve o navegador sem a empresa, e o `state`
	 * é que diz de quem é. Guarda só o hash do `state`.
	 */
	createConnectRequest(
		stateHash: string,
		request: ConnectRequest & { expiresAt: Date },
	): Promise<void>;
	/** Usa o pedido uma vez só: devolve `null` se não existe, já foi usado ou expirou. */
	consumeConnectRequest(
		stateHash: string,
		now: Date,
	): Promise<ConnectRequest | null>;
	/** Cria ou troca a conexão da empresa (reconectar substitui, RN-037). */
	saveConnection(
		companyId: string,
		connection: Omit<InstagramConnection, "companyId"> & {
			accessToken: string;
		},
	): Promise<InstagramConnection>;
	find(companyId: string): Promise<InstagramConnection | null>;
	findToken(
		companyId: string,
	): Promise<{ accessToken: string; expiresAt: Date } | null>;
	updateToken(
		companyId: string,
		token: { accessToken: string; expiresAt: Date },
	): Promise<void>;
	updateSnapshot(companyId: string, snapshot: InstagramSnapshot): Promise<void>;
	/** Para o job de renovação, que roda sem empresa no contexto. */
	listConnectedCompanyIds(): Promise<string[]>;
}
