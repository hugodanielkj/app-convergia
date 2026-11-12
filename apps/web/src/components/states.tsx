import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vazio: diz o que falta e qual é o próximo passo (design §13.3). */
export function EmptyState({
	icon: Icon,
	title,
	children,
}: {
	icon: LucideIcon;
	title: string;
	children?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
			<Icon className="size-10 text-brand-500" aria-hidden />
			<p className="text-base font-semibold">{title}</p>
			{children && (
				<div className="text-sm text-zinc-600 dark:text-zinc-400">
					{children}
				</div>
			)}
		</div>
	);
}

/** Carregamento com esqueleto, em vez de tela branca. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
	return (
		<div
			role="status"
			className="flex flex-col gap-3"
			aria-busy="true"
			aria-label="Carregando"
		>
			{Array.from({ length: rows }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas, sem reordenação.
					key={i}
					className="h-16 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800"
				/>
			))}
		</div>
	);
}

/** Erro com a mensagem que o servidor devolveu (regra de negócio §7). */
export function ErrorState({
	message,
	action,
}: {
	message: string;
	action?: ReactNode;
}) {
	return (
		<div
			role="alert"
			className="flex flex-col items-center gap-4 rounded-2xl bg-red-50 px-6 py-8 text-center text-red-900 dark:bg-red-950 dark:text-red-100"
		>
			<p className="text-base">{message}</p>
			{action}
		</div>
	);
}
