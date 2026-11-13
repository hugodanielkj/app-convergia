import { Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { type ContentDto, errorMessage } from "../../api/client";
import { BottomSheet } from "../../components/bottom-sheet";
import { useScriptMutations } from "./mutations";
import { RefineSheet } from "./refine-sheet";

/**
 * Botões de IA dentro do card (✅ RN-006): "Gerar roteiro" escreve tudo de uma vez e
 * "Refinar com a IA" abre a conversa com prévia (RN-073).
 */
export function ScriptAiActions({
	content,
	unsavedChanges,
	startRefining,
}: {
	content: ContentDto;
	unsavedChanges: boolean;
	startRefining: boolean;
}) {
	const { generate } = useScriptMutations(content.companyId);
	const [refining, setRefining] = useState(startRefining);
	const [confirmReplace, setConfirmReplace] = useState(false);
	const hasScript = Object.values(content.script).some(Boolean);

	const run = () => {
		setConfirmReplace(false);
		generate.mutate(content.id);
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-2 sm:flex-row">
				<button
					type="button"
					disabled={unsavedChanges || generate.isPending}
					onClick={() => (hasScript ? setConfirmReplace(true) : run())}
					className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white disabled:opacity-60"
				>
					<Sparkles className="size-5" aria-hidden />
					{generate.isPending
						? "Escrevendo o roteiro..."
						: hasScript
							? "Gerar de novo"
							: "Gerar roteiro"}
				</button>
				<button
					type="button"
					disabled={unsavedChanges || generate.isPending}
					onClick={() => setRefining(true)}
					className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 font-semibold text-brand-700 ring-1 ring-brand-300 disabled:opacity-60 dark:text-brand-200 dark:ring-brand-700"
				>
					<WandSparkles className="size-5" aria-hidden />
					Refinar com a IA
				</button>
			</div>
			{unsavedChanges && (
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					Salve ou descarte suas mudanças antes de usar a IA.
				</p>
			)}
			{generate.isError && (
				<p
					role="alert"
					className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
				>
					{errorMessage(generate.error)}
				</p>
			)}

			<BottomSheet
				open={confirmReplace}
				title="Gerar um roteiro novo?"
				onClose={() => setConfirmReplace(false)}
			>
				<div className="flex flex-col gap-3">
					<p className="text-zinc-700 dark:text-zinc-300">
						O roteiro atual será substituído. Para ajustar só uma parte, use
						"Refinar com a IA".
					</p>
					<button
						type="button"
						onClick={run}
						className="min-h-12 rounded-xl bg-brand-600 font-semibold text-white"
					>
						Gerar e substituir
					</button>
				</div>
			</BottomSheet>

			<RefineSheet
				companyId={content.companyId}
				contentId={content.id}
				open={refining}
				onClose={() => setRefining(false)}
			/>
		</div>
	);
}
