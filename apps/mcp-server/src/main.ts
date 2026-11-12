import { loadEnv } from "@convergia/config";
import { createApiKeyRepository, createDb } from "@convergia/infra";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createResolveActor } from "./auth/resolve-actor";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const app = createApp({
	resolveActor: createResolveActor({ apiKeys: createApiKeyRepository(db) }),
});

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
	console.log(`Servidor MCP em http://localhost:${port}/api/mcp`);
});
