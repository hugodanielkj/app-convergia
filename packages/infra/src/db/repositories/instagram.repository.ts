import type {
	InstagramConnection,
	InstagramRepository,
	InstagramSnapshot,
} from "@convergia/core";
import { and, eq, gt } from "drizzle-orm";
import type { TokenCipher } from "../../instagram/token-cipher";
import type { Db } from "../client";
import {
	companies,
	instagramConnections,
	instagramConnectRequests,
	type StoredSnapshot,
} from "../schema";
import { withCompany } from "../with-company";

type Row = typeof instagramConnections.$inferSelect;

function toStored(snapshot: InstagramSnapshot): StoredSnapshot {
	return {
		...snapshot,
		collectedAt: snapshot.collectedAt.toISOString(),
		posts: snapshot.posts.map((post) => ({
			...post,
			publishedAt: post.publishedAt?.toISOString() ?? null,
		})),
	};
}

function fromStored(stored: StoredSnapshot | null): InstagramSnapshot | null {
	if (!stored) return null;
	return {
		...stored,
		collectedAt: new Date(stored.collectedAt),
		posts: stored.posts.map((post) => ({
			...post,
			publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
		})),
	};
}

function toConnection(row: Row): InstagramConnection {
	return {
		companyId: row.companyId,
		igUserId: row.igUserId,
		username: row.username,
		connectedByUserId: row.connectedByUserId,
		connectedAt: row.connectedAt,
		tokenExpiresAt: row.tokenExpiresAt,
		simulated: row.simulated,
		snapshot: fromStored(row.snapshot),
	};
}

export function createInstagramRepository(
	db: Db,
	cipher: TokenCipher,
): InstagramRepository {
	return {
		async createConnectRequest(stateHash, request) {
			await db.insert(instagramConnectRequests).values({
				stateHash,
				companyId: request.companyId,
				userId: request.userId,
				expectedUsername: request.expectedUsername,
				expiresAt: request.expiresAt,
			});
		},

		async consumeConnectRequest(stateHash, now) {
			// Apaga e devolve na mesma instrução: dois retornos com o mesmo `state` não passam.
			const [row] = await db
				.delete(instagramConnectRequests)
				.where(
					and(
						eq(instagramConnectRequests.stateHash, stateHash),
						gt(instagramConnectRequests.expiresAt, now),
					),
				)
				.returning();
			return row
				? {
						companyId: row.companyId,
						userId: row.userId,
						expectedUsername: row.expectedUsername,
					}
				: null;
		},

		saveConnection(companyId, connection) {
			const values = {
				igUserId: connection.igUserId,
				username: connection.username,
				connectedByUserId: connection.connectedByUserId,
				connectedAt: connection.connectedAt,
				accessTokenEncrypted: cipher.encrypt(connection.accessToken),
				tokenExpiresAt: connection.tokenExpiresAt,
				simulated: connection.simulated,
				snapshot: connection.snapshot ? toStored(connection.snapshot) : null,
				updatedAt: new Date(),
			};
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.insert(instagramConnections)
					.values({ companyId, ...values })
					.onConflictDoUpdate({
						target: instagramConnections.companyId,
						set: values,
					})
					.returning();
				if (!row) throw new Error("A conexão do Instagram não foi gravada.");
				return toConnection(row);
			});
		},

		find(companyId) {
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.select()
					.from(instagramConnections)
					.where(eq(instagramConnections.companyId, companyId));
				return row ? toConnection(row) : null;
			});
		},

		findToken(companyId) {
			return withCompany(db, companyId, async (tx) => {
				const [row] = await tx
					.select({
						token: instagramConnections.accessTokenEncrypted,
						expiresAt: instagramConnections.tokenExpiresAt,
					})
					.from(instagramConnections)
					.where(eq(instagramConnections.companyId, companyId));
				return row
					? { accessToken: cipher.decrypt(row.token), expiresAt: row.expiresAt }
					: null;
			});
		},

		async updateToken(companyId, token) {
			await withCompany(db, companyId, (tx) =>
				tx
					.update(instagramConnections)
					.set({
						accessTokenEncrypted: cipher.encrypt(token.accessToken),
						tokenExpiresAt: token.expiresAt,
						updatedAt: new Date(),
					})
					.where(eq(instagramConnections.companyId, companyId)),
			);
		},

		async updateSnapshot(companyId, snapshot) {
			await withCompany(db, companyId, (tx) =>
				tx
					.update(instagramConnections)
					.set({ snapshot: toStored(snapshot), updatedAt: new Date() })
					.where(eq(instagramConnections.companyId, companyId)),
			);
		},

		async listConnectedCompanyIds() {
			// O RLS só mostra a empresa da transação: passa por cada uma (são poucas no protótipo).
			const all = await db.select({ id: companies.id }).from(companies);
			const connected: string[] = [];
			for (const { id } of all) {
				const found = await withCompany(db, id, (tx) =>
					tx
						.select({ id: instagramConnections.companyId })
						.from(instagramConnections)
						.where(eq(instagramConnections.companyId, id)),
				);
				if (found.length > 0) connected.push(id);
			}
			return connected;
		},
	};
}
