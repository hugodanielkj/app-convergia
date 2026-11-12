import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { ApiError } from "../api/client";
import { meQuery } from "../api/queries";
import { clearDevApiKey, getDevApiKey } from "./dev-session";

/** Quem está conectado; sem credencial válida, manda para a tela Entrar. */
export async function requireUser(queryClient: QueryClient) {
	if (!getDevApiKey()) {
		throw redirect({ to: "/entrar" });
	}
	try {
		return await queryClient.ensureQueryData(meQuery);
	} catch (error) {
		if (error instanceof ApiError && error.status === 401) {
			clearDevApiKey();
			queryClient.clear();
			throw redirect({ to: "/entrar" });
		}
		throw error;
	}
}
