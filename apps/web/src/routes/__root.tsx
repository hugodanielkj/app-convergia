import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { ErrorState } from "../components/states";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		component: Outlet,
		notFoundComponent: () => (
			<div className="mx-auto max-w-md p-4 pt-16">
				<ErrorState
					message="Esta página não existe."
					action={
						<Link to="/" className="font-semibold underline">
							Voltar ao início
						</Link>
					}
				/>
			</div>
		),
	},
);
