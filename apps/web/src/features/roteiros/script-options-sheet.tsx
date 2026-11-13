import { Sparkles } from "lucide-react";
import { errorMessage, type ScriptField } from "../../api/client";
import { BottomSheet } from "../../components/bottom-sheet";
import { SkeletonList } from "../../components/states";
import { useScriptMutations } from "./mutations";

export const SCRIPT_FIELD_LABEL: Record<
	ScriptField,
	{ name: string; plural: string }
> = {
	hook: { name: "gancho", plural: "ganchos" },
	body: { name: "corpo", plural: "corpos" },
	cta: { name: "CTA", plural: "CTAs" },
	caption: { name: "legenda", plural: "legendas" },
};

/**
 * Opções avulsas de uma parte do roteiro (📎 RN-071). A opção escolhida vai para o campo do
 * card, que só muda quando a pessoa salva. Renderize com `key={field}` para recomeçar a
 * cada parte.
 */
export function ScriptOptionsSheet({
	companyId,
	contentId,
	field,
	onClose,
	onUse,
}: {
	companyId: string;
	contentId: string;
	field: ScriptField | null;
	onClose: () => void;
	onUse: (field: ScriptField, text: string) => void;
}) {
	const { options } = useScriptMutations(companyId);
	if (!field) return null;
	const { name, plural } = SCRIPT_FIELD_LABEL[field];
	const generate = () => options.mutate({ contentId, field });

	return (
		<BottomSheet open title={`Opções de ${name}`} onClose={onClose}>
			<div className="flex flex-col gap-3">
				{options.isPending ? (
					<div role="status" aria-live="polite" className="flex flex-col gap-3">
						<p className="text-zinc-600 dark:text-zinc-400">
							Escrevendo as opções...
						</p>
						<SkeletonList rows={3} />
					</div>
				) : options.isSuccess ? (
					<>
						<ul className="flex max-h-[55dvh] flex-col gap-3 overflow-y-auto">
							{options.data.options.map((text, index) => (
								<li
									// A lista não muda depois de gerada; o texto pode se repetir.
									// biome-ignore lint/suspicious/noArrayIndexKey: ordem fixa.
									key={index}
									className="flex flex-col gap-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800"
								>
									<p className="whitespace-pre-wrap">{text}</p>
									<button
										type="button"
										onClick={() => {
											onUse(field, text);
											onClose();
										}}
										aria-label={`Usar a opção ${index + 1}`}
										className="min-h-11 rounded-xl bg-brand-600 font-semibold text-white"
									>
										Usar esta
									</button>
								</li>
							))}
						</ul>
						<button
							type="button"
							onClick={generate}
							className="min-h-12 rounded-xl font-medium ring-1 ring-zinc-300 dark:ring-zinc-700"
						>
							Gerar outras
						</button>
					</>
				) : (
					<>
						<p className="text-zinc-700 dark:text-zinc-300">
							A IA sugere até 3 {plural} para este roteiro. O card só muda se
							você escolher uma opção e salvar.
						</p>
						{options.isError && (
							<p
								role="alert"
								className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
							>
								{errorMessage(options.error)}
							</p>
						)}
						<button
							type="button"
							onClick={generate}
							className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white"
						>
							<Sparkles className="size-5" aria-hidden />
							{options.isError ? "Tentar de novo" : "Gerar opções"}
						</button>
					</>
				)}
			</div>
		</BottomSheet>
	);
}
