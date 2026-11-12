import { loadEnv } from "@convergia/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { resolveActor } from "./auth/resolve-actor";

const env = loadEnv();
const app = createApp({ resolveActor });

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
	console.log(`Servidor MCP em http://localhost:${port}/api/mcp`);
});
