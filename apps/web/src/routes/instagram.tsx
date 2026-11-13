import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ErrorState } from "../components/states";

/** Volta da Meta quando o link de conexão não vale mais e não dá para saber a empresa. */
export const Route = createFileRoute("/instagram")({
	validateSearch: z.object({
		instagram_erro: z.string().max(300).optional().catch(undefined),
	}),
	component: () => {
		const { instagram_erro } = Route.useSearch();
		return (
			<div className="mx-auto max-w-md p-4 pt-16">
				<ErrorState
					message={
						instagram_erro ??
						"Não foi possível conectar o Instagram. Volte ao app e tente de novo."
					}
					action={
						<Link to="/" className="font-semibold underline">
							Voltar ao app
						</Link>
					}
				/>
			</div>
		);
	},
});
