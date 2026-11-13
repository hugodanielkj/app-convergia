import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * Folha que sobe do rodapé no celular e vira uma janela centralizada no computador
 * (design §13.3).
 */
export function BottomSheet({
	open,
	title,
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const panel = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		// Mantém o foco num campo com autoFocus; senão, foca a folha para o leitor de tela.
		if (!panel.current?.contains(document.activeElement))
			panel.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
			<button
				type="button"
				aria-label="Fechar"
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
			/>
			<div
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				tabIndex={-1}
				className="relative w-full rounded-t-3xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none md:max-w-md md:rounded-3xl md:pb-6 dark:bg-zinc-900"
			>
				<div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300 md:hidden dark:bg-zinc-700" />
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-xl font-medium">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Fechar"
						className="flex size-11 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
					>
						<X className="size-5" aria-hidden />
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}
