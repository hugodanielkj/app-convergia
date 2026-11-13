import type {
	InstagramConnection,
	InstagramPost,
	InstagramProfile,
	InstagramSnapshot,
} from "../instagram";
import {
	type InstagramGateway,
	InstagramGatewayError,
	type InstagramToken,
} from "../ports/instagram-gateway";
import type {
	ConnectRequest,
	InstagramRepository,
} from "../ports/instagram-repository";

export function testProfile(
	overrides: Partial<InstagramProfile> = {},
): InstagramProfile {
	return {
		username: "padariadoze",
		name: "Padaria Doze",
		biography: "Pães de fermentação natural em Viçosa.",
		website: null,
		accountType: "business",
		followersCount: 1_200,
		followsCount: 300,
		mediaCount: 80,
		profilePictureUrl: null,
		...overrides,
	};
}

export function testPost(
	overrides: Partial<InstagramPost> = {},
): InstagramPost {
	return {
		id: "post-1",
		caption: "Fornada de sexta: pão de azeitona saindo agora.",
		mediaType: "video",
		permalink: "https://www.instagram.com/p/exemplo/",
		publishedAt: new Date("2026-11-10T12:00:00Z"),
		likeCount: 140,
		commentsCount: 12,
		...overrides,
	};
}

/** Dublê da API do Instagram para os testes. */
export class FakeInstagramGateway implements InstagramGateway {
	configured = true;
	simulated = false;
	profile = testProfile();
	posts: InstagramPost[] = [testPost()];
	failWith: InstagramGatewayError | null = null;
	exchangedCodes: string[] = [];
	refreshedTokens: string[] = [];
	private sequence = 0;

	constructor(private readonly now: () => Date = () => new Date()) {}

	authorizeUrl({ state }: { state: string; username: string }): string {
		return `https://www.instagram.com/oauth/authorize?state=${state}`;
	}

	async exchangeCode(code: string) {
		if (this.failWith) throw this.failWith;
		this.exchangedCodes.push(code);
		return { ...this.token(), igUserId: "ig-1" };
	}

	async refreshToken(accessToken: string): Promise<InstagramToken> {
		if (this.failWith) throw this.failWith;
		this.refreshedTokens.push(accessToken);
		return this.token();
	}

	async fetchSnapshot(_accessToken: string, limit: number) {
		if (this.failWith) throw this.failWith;
		return {
			profile: structuredClone(this.profile),
			posts: structuredClone(this.posts.slice(0, limit)),
		};
	}

	private token(): InstagramToken {
		this.sequence += 1;
		return {
			accessToken: `token-${this.sequence}`,
			expiresAt: new Date(this.now().getTime() + 60 * 86_400_000),
		};
	}
}

export function unavailable(): InstagramGatewayError {
	return new InstagramGatewayError("unavailable", "Instagram fora do ar");
}

/** Dublê do repositório de conexões do Instagram. */
export class InMemoryInstagramRepository implements InstagramRepository {
	readonly requests = new Map<string, ConnectRequest & { expiresAt: Date }>();
	readonly connections = new Map<
		string,
		InstagramConnection & { accessToken: string }
	>();

	async createConnectRequest(
		stateHash: string,
		request: ConnectRequest & { expiresAt: Date },
	): Promise<void> {
		this.requests.set(stateHash, { ...request });
	}

	async consumeConnectRequest(
		stateHash: string,
		now: Date,
	): Promise<ConnectRequest | null> {
		const request = this.requests.get(stateHash);
		this.requests.delete(stateHash);
		if (!request || request.expiresAt <= now) return null;
		const { expiresAt: _, ...rest } = request;
		return rest;
	}

	async saveConnection(
		companyId: string,
		connection: Omit<InstagramConnection, "companyId"> & {
			accessToken: string;
		},
	): Promise<InstagramConnection> {
		const saved = structuredClone({ ...connection, companyId });
		this.connections.set(companyId, saved);
		return this.view(saved);
	}

	async find(companyId: string): Promise<InstagramConnection | null> {
		const saved = this.connections.get(companyId);
		return saved ? this.view(saved) : null;
	}

	async findToken(companyId: string) {
		const saved = this.connections.get(companyId);
		return saved
			? { accessToken: saved.accessToken, expiresAt: saved.tokenExpiresAt }
			: null;
	}

	async updateToken(
		companyId: string,
		token: { accessToken: string; expiresAt: Date },
	): Promise<void> {
		const saved = this.connections.get(companyId);
		if (!saved) return;
		saved.accessToken = token.accessToken;
		saved.tokenExpiresAt = token.expiresAt;
	}

	async updateSnapshot(
		companyId: string,
		snapshot: InstagramSnapshot,
	): Promise<void> {
		const saved = this.connections.get(companyId);
		if (saved) saved.snapshot = structuredClone(snapshot);
	}

	async listConnectedCompanyIds(): Promise<string[]> {
		return [...this.connections.keys()];
	}

	private view(
		saved: InstagramConnection & { accessToken: string },
	): InstagramConnection {
		const { accessToken: _, ...connection } = structuredClone(saved);
		return connection;
	}
}
