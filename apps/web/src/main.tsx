import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "./api/client";
import { routeTree } from "./routeTree.gen";
import "./styles/app.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			// Erro de negócio (4xx) não melhora repetindo; só falha de rede ou do servidor.
			retry: (failureCount, error) =>
				failureCount < 1 &&
				!(
					error instanceof ApiError &&
					error.status >= 400 &&
					error.status < 500
				),
		},
	},
});

const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: "intent",
	defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
