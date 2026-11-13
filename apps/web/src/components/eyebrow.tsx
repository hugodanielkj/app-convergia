import type { ReactNode } from "react";

/** Rótulo curto acima de um título, com o ponto laranja, como no site da Convergia. */
export function Eyebrow({ children }: { children: ReactNode }) {
	return (
		<p className="flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-zinc-700 uppercase dark:text-zinc-300">
			<span className="size-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
			{children}
		</p>
	);
}
