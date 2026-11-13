import { useMutation, useQuery } from "@tanstack/react-query";
import {
	AtSign,
	CircleCheckBig,
	ExternalLink,
	Heart,
	MessageCircle,
	RefreshCw,
} from "lucide-react";
import { useId, useState } from "react";
import { api, errorMessage, type InstagramDto } from "../../api/client";
import { instagramQuery } from "../../api/queries";
import { ErrorState, SkeletonList } from "../../components/states";

type Connection = Extract<InstagramDto, { status: "connected" }>["connection"];
type Post = NonNullable<Connection["snapshot"]>["posts"][number];

const count = new Intl.NumberFormat("pt-BR");
const moment = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
});

/**
 * Instagram da empresa na tela Desempenho (design §13.2). O cliente conecta pela Meta (RN-034,
 * RN-035); a agência vê o aviso enquanto ele não conecta.
 */
export function InstagramPanel({
	companyId,
	isAgency,
}: {
	companyId: string;
	isAgency: boolean;
}) {
	const query = useQuery(instagramQuery(companyId));
	const [reconnecting, setReconnecting] = useState(false);

	if (query.isPending) return <SkeletonList rows={2} />;
	if (query.isError) {
		return (
			<ErrorState
				message={errorMessage(query.error)}
				action={
					<button
						type="button"
						onClick={() => void query.refetch()}
						className="font-semibold underline"
					>
						Tentar de novo
					</button>
				}
			/>
		);
	}

	const view = query.data;
	return (
		<section
			aria-labelledby="instagram-titulo"
			className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
		>
			<div className="flex items-center gap-2">
				<AtSign className="size-6 text-brand-600" aria-hidden />
				<h2 id="instagram-titulo" className="flex-1 text-xl font-medium">
					Instagram da empresa
				</h2>
				{view.simulated && (
					<span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
						Simulado
					</span>
				)}
			</div>

			{view.status === "not_configured" && (
				<p className="text-zinc-700 dark:text-zinc-300">
					A conexão com o Instagram ainda não foi configurada neste ambiente.
					Peça para a equipe técnica configurar o app da Meta.
				</p>
			)}

			{view.status === "connected" && !reconnecting && (
				<ConnectedProfile connection={view.connection} />
			)}

			{view.status !== "not_configured" &&
				(isAgency ? (
					view.status === "not_connected" && (
						<p className="text-zinc-700 dark:text-zinc-300">
							O cliente ainda não conectou o Instagram desta empresa. Peça para
							ele conectar em Mais › Desempenho; a IA passa a usar o perfil e os
							posts recentes nos roteiros.
						</p>
					)
				) : view.status === "not_connected" || reconnecting ? (
					<ConnectForm
						companyId={companyId}
						simulated={view.simulated}
						defaultUsername={
							view.status === "connected" ? view.connection.username : ""
						}
						onCancel={reconnecting ? () => setReconnecting(false) : undefined}
					/>
				) : (
					<button
						type="button"
						onClick={() => setReconnecting(true)}
						className="flex min-h-11 items-center justify-center gap-2 self-start rounded-full px-4 text-sm font-medium ring-1 ring-zinc-300 dark:ring-zinc-700"
					>
						<RefreshCw className="size-4" aria-hidden />
						Reconectar
					</button>
				))}
		</section>
	);
}

function ConnectForm({
	companyId,
	simulated,
	defaultUsername,
	onCancel,
}: {
	companyId: string;
	simulated: boolean;
	defaultUsername: string;
	onCancel?: (() => void) | undefined;
}) {
	const id = useId();
	const [username, setUsername] = useState(defaultUsername);
	const connect = useMutation({
		mutationFn: () => api.connectInstagram(companyId, username),
		// A Meta autoriza na própria página e devolve a pessoa para esta tela.
		onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
	});

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				connect.mutate();
			}}
		>
			<p className="text-zinc-700 dark:text-zinc-300">
				Conecte o Instagram da empresa para a IA entender a marca ao escrever os
				roteiros. Ela lê o perfil, as legendas dos posts recentes e as curtidas
				e comentários de cada um.
			</p>
			<p className="text-sm text-zinc-600 dark:text-zinc-400">
				A conta precisa ser Profissional (comercial ou de criador de conteúdo).
				Você entra pela página do Instagram; o app não vê a sua senha.
			</p>
			{simulated && (
				<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
					Ambiente de desenvolvimento: a conexão usa um Instagram simulado, com
					dados de exemplo.
				</p>
			)}
			<label htmlFor={id} className="text-sm font-medium">
				@ da empresa no Instagram
			</label>
			<div className="flex items-center rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950">
				<span className="text-zinc-500" aria-hidden>
					@
				</span>
				<input
					id={id}
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					required
					maxLength={31}
					autoCapitalize="none"
					autoCorrect="off"
					autoComplete="off"
					spellCheck={false}
					inputMode="text"
					placeholder="suaempresa"
					className="min-h-12 flex-1 bg-transparent px-1 outline-none"
				/>
			</div>
			{connect.error && (
				<p role="alert" className="text-sm text-red-700 dark:text-red-300">
					{errorMessage(connect.error)}
				</p>
			)}
			<div className="flex flex-col gap-2 sm:flex-row">
				<button
					type="submit"
					disabled={connect.isPending || username.trim() === ""}
					className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 font-semibold text-white disabled:opacity-60"
				>
					<AtSign className="size-5" aria-hidden />
					{connect.isPending
						? "Abrindo o Instagram..."
						: "Conectar com o Instagram"}
				</button>
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						className="min-h-12 rounded-full px-4 font-medium ring-1 ring-zinc-300 dark:ring-zinc-700"
					>
						Cancelar
					</button>
				)}
			</div>
		</form>
	);
}

function ConnectedProfile({ connection }: { connection: Connection }) {
	const snapshot = connection.snapshot;
	const profile = snapshot?.profile;
	const engagement = (post: Post) =>
		(post.likeCount ?? 0) + (post.commentsCount ?? 0);
	const top = [...(snapshot?.posts ?? [])]
		.sort((a, b) => engagement(b) - engagement(a))
		.slice(0, 3);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-start gap-3">
				{profile?.profilePictureUrl ? (
					<img
						src={profile.profilePictureUrl}
						alt=""
						className="size-14 shrink-0 rounded-full object-cover"
					/>
				) : (
					<span
						aria-hidden
						className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100"
					>
						{connection.username.charAt(0).toUpperCase()}
					</span>
				)}
				<div className="flex min-w-0 flex-col gap-0.5">
					<a
						href={`https://www.instagram.com/${connection.username}/`}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
					>
						@{connection.username}
						<ExternalLink className="size-3.5" aria-hidden />
						<span className="sr-only">(abre o Instagram)</span>
					</a>
					{profile?.name && (
						<span className="text-sm text-zinc-700 dark:text-zinc-300">
							{profile.name}
						</span>
					)}
					{profile && (
						<span className="text-sm text-zinc-600 dark:text-zinc-400">
							{[
								profile.followersCount !== null &&
									`${count.format(profile.followersCount)} seguidores`,
								profile.mediaCount !== null &&
									`${count.format(profile.mediaCount)} posts`,
							]
								.filter(Boolean)
								.join(" · ")}
						</span>
					)}
				</div>
			</div>
			{profile?.biography && (
				<p className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">
					{profile.biography}
				</p>
			)}

			<div className="flex flex-col gap-2 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
				<p className="flex items-center gap-2 text-sm font-semibold">
					<CircleCheckBig className="size-4 text-brand-600" aria-hidden />A IA
					usa estes dados nos roteiros
				</p>
				<p className="text-sm text-zinc-700 dark:text-zinc-300">
					Perfil, legendas de {snapshot?.posts.length ?? 0} posts recentes e as
					curtidas e comentários de cada um.
					{snapshot &&
						` Lidos em ${moment.format(new Date(snapshot.collectedAt))}.`}
				</p>
			</div>

			{top.length > 0 && (
				<div className="flex flex-col gap-2">
					<h3 className="text-sm font-semibold">Posts que mais engajaram</h3>
					<ul className="flex flex-col gap-2">
						{top.map((post) => (
							<li
								key={post.id}
								className="flex flex-col gap-1 rounded-xl p-3 ring-1 ring-zinc-200 dark:ring-zinc-800"
							>
								<p className="line-clamp-2 text-sm">
									{post.caption ?? "(sem legenda)"}
								</p>
								<p className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
									<span className="flex items-center gap-1">
										<Heart className="size-3.5" aria-hidden />
										{post.likeCount ?? "—"}
										<span className="sr-only">curtidas</span>
									</span>
									<span className="flex items-center gap-1">
										<MessageCircle className="size-3.5" aria-hidden />
										{post.commentsCount ?? "—"}
										<span className="sr-only">comentários</span>
									</span>
								</p>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
