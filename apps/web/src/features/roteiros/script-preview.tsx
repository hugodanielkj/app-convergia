import type { ContentDto } from "../../api/client";

const FIELDS = [
	["hook", "Gancho"],
	["body", "Corpo"],
	["cta", "Chamada para ação"],
	["caption", "Legenda"],
] as const;

/** Roteiro em modo leitura: resultado da geração e prévias do refino. */
export function ScriptPreview({ script }: { script: ContentDto["script"] }) {
	return (
		<dl className="flex flex-col gap-3">
			{FIELDS.map(([key, label]) => (
				<div key={key} className="flex flex-col gap-0.5">
					<dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
						{label}
					</dt>
					<dd className="whitespace-pre-wrap">{script[key] ?? "—"}</dd>
				</div>
			))}
		</dl>
	);
}
