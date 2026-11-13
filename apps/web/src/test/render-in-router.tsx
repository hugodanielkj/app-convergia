import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

/** Renderiza um componente que usa Link, numa rota de teste no caminho `path`. */
export function renderInRouter(ui: ReactNode, path = "/empresas/c1") {
	const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
		component: Outlet,
	});
	const page = createRoute({
		getParentRoute: () => root,
		path: "$",
		component: () => ui,
	});
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const router = createRouter({
		routeTree: root.addChildren([page]),
		history: createMemoryHistory({ initialEntries: [path] }),
		context: { queryClient },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}
