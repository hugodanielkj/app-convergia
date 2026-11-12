import { type FormEvent, useEffect, useRef, useState } from "react";
import { BottomSheet } from "../../components/bottom-sheet";
import { dayLabel } from "../../lib/dates";

/** Novo card: só o título; o resto se edita na tela do card. */
export function NewContentSheet({
	open,
	plannedDate,
	onClose,
	onCreate,
	error,
	busy,
}: {
	open: boolean;
	plannedDate?: string | null;
	onClose: () => void;
	onCreate: (input: { title: string; plannedDate: string | null }) => void;
	error?: string | null;
	busy?: boolean;
}) {
	const [title, setTitle] = useState("");
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) return;
		setTitle("");
		// Abre o teclado direto no título.
		input.current?.focus();
	}, [open]);

	function submit(event: FormEvent) {
		event.preventDefault();
		onCreate({ title: title.trim(), plannedDate: plannedDate ?? null });
	}

	return (
		<BottomSheet open={open} title="Novo card" onClose={onClose}>
			<form onSubmit={submit} className="flex flex-col gap-4">
				<label className="flex flex-col gap-2">
					<span className="text-sm font-medium">Sobre o que é o post?</span>
					<input
						required
						ref={input}
						maxLength={200}
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						name="title"
						autoComplete="off"
						enterKeyHint="done"
						placeholder="Ex.: Bastidores da nova coleção"
						className="min-h-12 rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
					/>
				</label>
				{plannedDate && (
					<p className="text-sm text-zinc-600 dark:text-zinc-400">
						Planejado para {dayLabel(plannedDate)}
					</p>
				)}
				{error && (
					<p
						role="alert"
						className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
					>
						{error}
					</p>
				)}
				<button
					type="submit"
					disabled={busy || title.trim() === ""}
					className="min-h-12 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
				>
					{busy ? "Criando..." : "Criar card"}
				</button>
			</form>
		</BottomSheet>
	);
}
