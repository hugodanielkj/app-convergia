import { useQuery } from "@tanstack/react-query";
import { MessagesSquare, SendHorizontal } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { errorMessage, type RefineMessageDto } from "../../api/client";
import { refineChatQuery } from "../../api/queries";
import { BottomSheet } from "../../components/bottom-sheet";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
import { cn } from "../../lib/cn";
import { useScriptMutations } from "./mutations";
import { ScriptPreview } from "./script-preview";

const SUGGESTIONS = [
	"Deixe o gancho mais curto",
	"Use um tom mais divertido",
	"Troque a chamada para ação",
];

const STATUS_NOTE = {
	applied: "Aplicada no card",
	discarded: "Descartada",
} as const;

/**
 * Conversa com a IA dentro do card (✅ RN-006). Cada resposta traz uma prévia que só muda o
 * roteiro quando a pessoa toca em "Aplicar no card" (📎 RN-073).
 */
export function RefineSheet({
	companyId,
	contentId,
	open,
	onClose,
}: {
	companyId: string;
	contentId: string;
	open: boolean;
	onClose: () => void;
}) {
	const chat = useQuery({
		...refineChatQuery(companyId, contentId),
		enabled: open,
	});
	const { refine, review } = useScriptMutations(companyId);
	const [draft, setDraft] = useState("");
	const list = useRef<HTMLDivElement>(null);
	const messages = chat.data?.messages ?? [];

	// biome-ignore lint/correctness/useExhaustiveDependencies: rola para o fim a cada mensagem nova.
	useEffect(() => {
		const element = list.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [messages.length, refine.isPending]);

	const send = (event: FormEvent) => {
		event.preventDefault();
		const message = draft.trim();
		if (!message || refine.isPending) return;
		review.reset();
		refine.mutate({ contentId, message }, { onSuccess: () => setDraft("") });
	};
	const decide = (messageId: string, decision: "apply" | "discard") => {
		refine.reset();
		review.mutate(
			{ contentId, messageId, decision },
			{ onSettled: () => void chat.refetch() },
		);
	};
	const error = refine.error ?? review.error;

	return (
		<BottomSheet open={open} title="Refinar roteiro" onClose={onClose}>
			<div className="flex flex-col gap-3">
				<div
					ref={list}
					aria-live="polite"
					className="flex max-h-[55dvh] min-h-40 flex-col gap-3 overflow-y-auto"
				>
					{chat.isPending ? (
						<SkeletonList rows={2} />
					) : chat.isError ? (
						<ErrorState message={errorMessage(chat.error)} />
					) : messages.length === 0 && !refine.isPending ? (
						<EmptyState
							icon={MessagesSquare}
							title="Diga o que mudar no roteiro"
						>
							<div className="mt-2 flex flex-wrap justify-center gap-2">
								{SUGGESTIONS.map((suggestion) => (
									<button
										key={suggestion}
										type="button"
										onClick={() => setDraft(suggestion)}
										className="min-h-11 rounded-full bg-brand-50 px-3 text-sm font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100"
									>
										{suggestion}
									</button>
								))}
							</div>
						</EmptyState>
					) : (
						messages.map((message) => (
							<Bubble
								key={message.id}
								message={message}
								busy={review.isPending}
								onDecide={decide}
							/>
						))
					)}
					{refine.isPending && (
						<p
							role="status"
							className="w-fit animate-pulse rounded-2xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800"
						>
							A IA está reescrevendo o roteiro...
						</p>
					)}
				</div>

				{error && (
					<p
						role="alert"
						className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
					>
						{errorMessage(error)}
					</p>
				)}

				<form onSubmit={send} className="flex items-end gap-2">
					<label htmlFor="refine-message" className="sr-only">
						O que mudar no roteiro
					</label>
					<textarea
						id="refine-message"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						rows={2}
						maxLength={2000}
						placeholder="Ex.: deixe o gancho mais curto"
						className="min-h-12 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-950"
					/>
					<button
						type="submit"
						aria-label="Enviar pedido"
						disabled={!draft.trim() || refine.isPending}
						className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white disabled:opacity-50"
					>
						<SendHorizontal className="size-5" aria-hidden />
					</button>
				</form>
			</div>
		</BottomSheet>
	);
}

function Bubble({
	message,
	busy,
	onDecide,
}: {
	message: RefineMessageDto;
	busy: boolean;
	onDecide: (messageId: string, decision: "apply" | "discard") => void;
}) {
	if (message.role === "user") {
		return (
			<p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 whitespace-pre-wrap text-white">
				{message.text}
			</p>
		);
	}
	const status = message.previewStatus;
	return (
		<div className="flex max-w-[95%] flex-col gap-2 rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
			<p className="whitespace-pre-wrap">{message.text}</p>
			{message.preview && (
				<div
					className={cn(
						"rounded-xl bg-white p-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700",
						status !== "pending" && "opacity-70",
					)}
				>
					<p className="mb-2 text-sm font-semibold">Prévia do roteiro</p>
					<ScriptPreview script={message.preview} />
				</div>
			)}
			{status === "pending" ? (
				<div className="flex gap-2">
					<button
						type="button"
						disabled={busy}
						onClick={() => onDecide(message.id, "discard")}
						className="min-h-11 flex-1 rounded-xl font-medium ring-1 ring-zinc-300 disabled:opacity-60 dark:ring-zinc-600"
					>
						Descartar
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => onDecide(message.id, "apply")}
						className="min-h-11 flex-[2] rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"
					>
						Aplicar no card
					</button>
				</div>
			) : (
				status && (
					<p className="text-sm text-zinc-600 dark:text-zinc-400">
						{STATUS_NOTE[status]}
					</p>
				)
			)}
		</div>
	);
}
