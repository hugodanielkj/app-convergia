import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireUser } from "../lib/require-user";

/** Porta de entrada: o cliente vai direto para a própria empresa (RN-021). */
export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		const me = await requireUser(context.queryClient);
		if (me.companyId) {
			throw redirect({
				to: "/empresas/$companyId",
				params: { companyId: me.companyId },
			});
		}
		throw redirect({ to: "/empresas" });
	},
});
