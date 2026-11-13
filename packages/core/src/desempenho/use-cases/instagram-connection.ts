import { assertCanWrite } from "../../policies/permission.policy";
import type { ActorContext } from "../../shared/actor-context";
import type { DomainError } from "../../shared/domain-error";
import {
	connectCancelled,
	connectLinkExpired,
	instagramNotConfigured,
	instagramUnavailable,
	notProfessionalAccount,
	onlyClientConnects,
	wrongAccount,
} from "../errors";
import {
	CONNECT_LINK_MINUTES,
	type ConnectInstagramInput,
	type InstagramConnection,
	type InstagramSnapshot,
	normalizeHandle,
	RECENT_POSTS_LIMIT,
} from "../instagram";
import {
	type InstagramGateway,
	InstagramGatewayError,
} from "../ports/instagram-gateway";
import type { InstagramRepository } from "../ports/instagram-repository";

export type InstagramDeps = {
	instagram: InstagramRepository;
	instagramGateway: InstagramGateway;
	now: () => Date;
};

/** Renova o token quando faltam menos dias que isso para expirar (60 dias de validade). */
const REFRESH_WHEN_DAYS_LEFT = 30;
const DAY = 86_400_000;

/**
 * ✅ RN-034, RN-035: o cliente informa o @ e recebe o link da autenticação da Meta. A agência
 * não conecta.
 */
export async function startInstagramConnection(
	deps: InstagramDeps,
	actor: ActorContext,
	input: ConnectInstagramInput,
): Promise<{ authorizeUrl: string }> {
	assertCanWrite(actor);
	if (actor.kind !== "client_user") throw onlyClientConnects();
	if (!deps.instagramGateway.configured) throw instagramNotConfigured();
	const username = normalizeHandle(input.username);
	const state = randomState();
	await deps.instagram.createConnectRequest(await hashState(state), {
		companyId: actor.companyId,
		userId: actor.userId,
		expectedUsername: username,
		expiresAt: new Date(deps.now().getTime() + CONNECT_LINK_MINUTES * 60_000),
	});
	return {
		authorizeUrl: deps.instagramGateway.authorizeUrl({
			state,
			username,
		}),
	};
}

export type ConnectOutcome = {
	/** Empresa do pedido, para devolver a pessoa à tela certa; `null` se o link não vale. */
	companyId: string | null;
	connection: InstagramConnection | null;
	error: DomainError | null;
};

/**
 * Volta da autenticação da Meta. Não tem usuário logado: quem diz de quem é o pedido é o
 * `state`, que vale uma vez só e por pouco tempo.
 */
export async function completeInstagramConnection(
	deps: InstagramDeps,
	input: { state: string | null; code: string | null; error: string | null },
): Promise<ConnectOutcome> {
	const request = input.state
		? await deps.instagram.consumeConnectRequest(
				await hashState(input.state),
				deps.now(),
			)
		: null;
	if (!request) {
		return { companyId: null, connection: null, error: connectLinkExpired() };
	}
	const fail = (error: DomainError): ConnectOutcome => ({
		companyId: request.companyId,
		connection: null,
		error,
	});
	if (input.error || !input.code) return fail(connectCancelled());

	try {
		const token = await deps.instagramGateway.exchangeCode(input.code);
		const { profile, posts } = await deps.instagramGateway.fetchSnapshot(
			token.accessToken,
			RECENT_POSTS_LIMIT,
		);
		const username = normalizeHandle(profile.username);
		if (username !== request.expectedUsername) {
			return fail(wrongAccount(username, request.expectedUsername));
		}
		const now = deps.now();
		const connection = await deps.instagram.saveConnection(request.companyId, {
			igUserId: token.igUserId,
			username,
			connectedByUserId: request.userId,
			connectedAt: now,
			accessToken: token.accessToken,
			tokenExpiresAt: token.expiresAt,
			simulated: deps.instagramGateway.simulated,
			snapshot: { profile, posts, collectedAt: now },
		});
		return { companyId: request.companyId, connection, error: null };
	} catch (error) {
		return fail(gatewayError(error));
	}
}

export type InstagramConnectionView =
	| { status: "not_configured"; connection: null }
	| { status: "not_connected"; connection: null }
	| { status: "connected"; connection: InstagramConnection };

/** Situação da conexão da empresa. A agência vê, mas não conecta (RN-034). */
export async function getInstagramConnection(
	deps: InstagramDeps,
	actor: ActorContext,
): Promise<InstagramConnectionView> {
	const connection = await deps.instagram.find(actor.companyId);
	if (connection) return { status: "connected", connection };
	return deps.instagramGateway.configured
		? { status: "not_connected", connection: null }
		: { status: "not_configured", connection: null };
}

/** ✅ RN-032, RN-076: o contexto da marca para a IA é o último retrato do Instagram. */
export async function brandContext(
	deps: Pick<InstagramDeps, "instagram">,
	companyId: string,
): Promise<InstagramSnapshot | null> {
	return (await deps.instagram.find(companyId))?.snapshot ?? null;
}

/**
 * Job diário: renova o token antes de expirar e atualiza o retrato do Instagram de cada empresa
 * conectada. Uma empresa com problema não impede as outras.
 */
export async function refreshInstagramConnections(
	deps: InstagramDeps,
): Promise<{ refreshed: number; failed: number }> {
	let refreshed = 0;
	let failed = 0;
	for (const companyId of await deps.instagram.listConnectedCompanyIds()) {
		try {
			await refreshCompany(deps, companyId);
			refreshed += 1;
		} catch (error) {
			failed += 1;
			console.error(`Instagram da empresa ${companyId} não atualizou`, error);
		}
	}
	return { refreshed, failed };
}

async function refreshCompany(
	deps: InstagramDeps,
	companyId: string,
): Promise<void> {
	let token = await deps.instagram.findToken(companyId);
	if (!token) return;
	const now = deps.now();
	if (token.expiresAt.getTime() <= now.getTime()) return;
	if (
		token.expiresAt.getTime() - now.getTime() <
		REFRESH_WHEN_DAYS_LEFT * DAY
	) {
		token = await deps.instagramGateway.refreshToken(token.accessToken);
		await deps.instagram.updateToken(companyId, token);
	}
	const { profile, posts } = await deps.instagramGateway.fetchSnapshot(
		token.accessToken,
		RECENT_POSTS_LIMIT,
	);
	await deps.instagram.updateSnapshot(companyId, {
		profile,
		posts,
		collectedAt: now,
	});
}

function gatewayError(error: unknown): DomainError {
	if (error instanceof InstagramGatewayError) {
		return error.kind === "not_professional"
			? notProfessionalAccount()
			: instagramUnavailable();
	}
	console.error("Falha inesperada ao conectar o Instagram", error);
	return instagramUnavailable();
}

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

async function hashState(state: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(state),
	);
	return Array.from(new Uint8Array(digest), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
}
