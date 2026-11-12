import { KeyRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { setDevApiKey } from "../../lib/dev-session";

/**
 * Entrada só para desenvolvimento local: usa a chave de API gerada pelo `pnpm db:seed`.
 * O login de verdade depende de Q-31 e Q-32.
 */
export function DevLogin({ onDone }: { onDone: () => void }) {
	const [key, setKey] = useState("");

	function submit(event: FormEvent) {
		event.preventDefault();
		setDevApiKey(key.trim());
		onDone();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			<label className="flex flex-col gap-2">
				<span className="text-sm font-medium">Chave de desenvolvimento</span>
				<input
					required
					value={key}
					onChange={(event) => setKey(event.target.value)}
					name="api-key"
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					placeholder="ag_mcp_..."
					className="min-h-12 rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
				/>
				<span className="text-sm text-zinc-600 dark:text-zinc-400">
					Rode <code>pnpm db:seed</code> e cole uma das chaves que ele mostrar.
				</span>
			</label>
			<button
				type="submit"
				className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700"
			>
				<KeyRound className="size-5" aria-hidden />
				Entrar
			</button>
		</form>
	);
}
