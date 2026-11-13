import { useId, useState } from "react";
import { BottomSheet } from "../../components/bottom-sheet";

export type DecisionMode = "reject" | "approve_on_behalf";

const COPY: Record<
	DecisionMode,
	{
		title: string;
		intro: string;
		label: string;
		placeholder: string;
		confirm: string;
		required: boolean;
	}
> = {
	// RN-212: o motivo da recusa é opcional.
	reject: {
		title: "Recusar roteiro",
		intro: "O roteiro volta para a agência ajustar.",
		label: "O que a agência precisa mudar? (opcional)",
		placeholder: "Ex.: o gancho pode ser mais direto",
		confirm: "Recusar",
		required: false,
	},
	// RN-214: a agência aprova em nome do cliente só com motivo, e isso fica registrado.
	approve_on_behalf: {
		title: "Aprovar em nome do cliente",
		intro: "Fica registrado que a aprovação foi feita pela agência.",
		label: "Como o cliente aprovou?",
		placeholder: "Ex.: aprovou por WhatsApp em 10/11",
		confirm: "Aprovar em nome do cliente",
		required: true,
	},
};

/** Folha para recusar com motivo ou aprovar em nome do cliente. */
export function DecisionSheet({
	mode,
	itemType = "script",
	busy = false,
	error = null,
	onClose,
	onConfirm,
}: {
	mode: DecisionMode | null;
	itemType?: "script" | "idea";
	busy?: boolean;
	error?: string | null;
	onClose: () => void;
	onConfirm: (reason: string | undefined) => void;
}) {
	const id = useId();
	const [reason, setReason] = useState("");
	const baseCopy = COPY[mode ?? "reject"];
	const copy =
		itemType === "idea" && mode === "reject"
			? {
					...baseCopy,
					title: "Recusar ideia",
					intro: "A ideia volta para a agência revisar.",
				}
			: baseCopy;
	const trimmed = reason.trim();
	const close = () => {
		setReason("");
		onClose();
	};

	return (
		<BottomSheet open={mode !== null} title={copy.title} onClose={close}>
			<form
				className="flex flex-col gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					onConfirm(trimmed || undefined);
				}}
			>
				<p className="text-zinc-700 dark:text-zinc-300">{copy.intro}</p>
				<label htmlFor={id} className="text-sm font-medium">
					{copy.label}
				</label>
				<textarea
					id={id}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					rows={3}
					maxLength={copy.required ? 500 : 1000}
					placeholder={copy.placeholder}
					// biome-ignore lint/a11y/noAutofocus: a folha abre para escrever o motivo.
					autoFocus
					className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950"
				/>
				{error && (
					<p role="alert" className="text-sm text-red-700 dark:text-red-300">
						{error}
					</p>
				)}
				<button
					type="submit"
					disabled={busy || (copy.required && trimmed === "")}
					className={
						mode === "reject"
							? "min-h-12 rounded-full bg-zinc-900 font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
							: "min-h-12 rounded-full bg-brand-600 font-semibold text-white disabled:opacity-60"
					}
				>
					{busy ? "Enviando..." : copy.confirm}
				</button>
			</form>
		</BottomSheet>
	);
}
