import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DevLogin } from "../features/entrar/dev-login";

export const Route = createFileRoute("/entrar")({
	component: Entrar,
});

function Entrar() {
	const navigate = useNavigate();
	const { queryClient } = Route.useRouteContext();

	return (
		<div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
			<div className="flex flex-col items-center gap-3 text-center">
				<img src="/logo.svg" alt="" className="size-16" />
				<h1 className="text-2xl font-bold">ConvergIA</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					O conteúdo do Instagram da sua empresa, com a sua agência.
				</p>
			</div>
			{import.meta.env.DEV ? (
				<DevLogin
					onDone={() => {
						queryClient.clear();
						void navigate({ to: "/" });
					}}
				/>
			) : (
				<p className="rounded-2xl bg-zinc-100 p-4 text-center text-sm dark:bg-zinc-900">
					O login ainda não está disponível.
				</p>
			)}
		</div>
	);
}
