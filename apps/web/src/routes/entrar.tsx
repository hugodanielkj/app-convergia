import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "../components/brand-logo";
import { Eyebrow } from "../components/eyebrow";
import { DevLogin } from "../features/entrar/dev-login";

export const Route = createFileRoute("/entrar")({
	component: Entrar,
});

function Entrar() {
	const navigate = useNavigate();
	const { queryClient } = Route.useRouteContext();

	return (
		<div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
			<div className="flex flex-col gap-5">
				<BrandLogo className="h-9 w-auto self-start text-zinc-900 dark:text-zinc-50" />
				<Eyebrow>ConvergIA · Conteúdo para Instagram</Eyebrow>
				<h1 className="text-4xl leading-tight font-medium">
					O conteúdo da sua empresa,{" "}
					<span className="text-brand-600">com a sua agência.</span>
				</h1>
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
