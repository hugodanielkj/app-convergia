import { useQuery } from "@tanstack/react-query";
import { CircleCheckBig, History, Send, Undo2, X } from "lucide-react";
import { useState } from "react";
import { type ContentDto, errorMessage } from "../../api/client";
import { approvalQuery } from "../../api/queries";
import { BottomSheet } from "../../components/bottom-sheet";
import { ApprovalHistory } from "./approval-history";
import { type DecisionMode, DecisionSheet } from "./decision-sheet";
import { momentLabel } from "./labels";
import { useApprovalMutations } from "./mutations";

const primary =
	"flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 font-semibold text-white disabled:opacity-60";
const secondary =
	"flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 font-medium ring-1 ring-zinc-300 disabled:opacity-60 dark:ring-zinc-700";

/**
 * Aprovação do roteiro dentro do card (regra de negócio §5): o que está acontecendo e o que
 * cada lado pode fazer agora.
 */
export function ApprovalPanel({
	content,
	isAgency,
	unsavedChanges,
}: {
	content: ContentDto;
	isAgency: boolean;
	unsavedChanges: boolean;
}) {
	const { companyId, id, approvalStatus: status } = content;
	const mutations = useApprovalMutations(companyId);
	const detail = useQuery({
		...approvalQuery(companyId, id),
		enabled: status !== "none",
	});
	const [decision, setDecision] = useState<DecisionMode | null>(null);
	const [showHistory, setShowHistory] = useState(false);

	// RN-204: roteiro só do cliente não passa por aprovação.
	if (status === "none") return null;

	const request = detail.data?.request ?? null;
	const version = content.contentVersion;
	const error =
		mutations.submit.error ??
		mutations.cancel.error ??
		(decision === null
			? (mutations.approve.error ?? mutations.reject.error)
			: null);
	const decisionError =
		decision === "reject" ? mutations.reject.error : mutations.approve.error;
	const busy =
		mutations.submit.isPending ||
		mutations.cancel.isPending ||
		mutations.approve.isPending ||
		mutations.reject.isPending;

	return (
		<section
			aria-labelledby="aprovacao-titulo"
			className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
		>
			<div className="flex items-center justify-between gap-2">
				<h2 id="aprovacao-titulo" className="text-xl font-medium">
					Aprovação
				</h2>
				<button
					type="button"
					onClick={() => setShowHistory(true)}
					className="-my-2 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
				>
					<History className="size-4" aria-hidden />
					Histórico
				</button>
			</div>

			<StatusText
				status={status}
				isAgency={isAgency}
				request={request}
				changedSinceSubmit={detail.data?.changedSinceSubmit ?? false}
			/>

			{error && (
				<p
					role="alert"
					className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
				>
					{errorMessage(error)}
				</p>
			)}

			{isAgency && status === "in_preparation" && (
				<>
					<button
						type="button"
						disabled={busy || unsavedChanges}
						onClick={() => mutations.submit.mutate(id)}
						className={primary}
					>
						<Send className="size-5" aria-hidden />
						{mutations.submit.isPending
							? "Enviando..."
							: "Enviar para aprovação"}
					</button>
					{unsavedChanges && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Salve as mudanças antes de enviar.
						</p>
					)}
				</>
			)}

			{status === "pending" && (
				<div className="flex flex-col gap-2 sm:flex-row">
					{isAgency ? (
						<>
							<button
								type="button"
								disabled={busy || unsavedChanges}
								onClick={() => setDecision("approve_on_behalf")}
								className={primary}
							>
								<CircleCheckBig className="size-5" aria-hidden />
								Aprovar em nome do cliente
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => mutations.cancel.mutate(id)}
								className={secondary}
							>
								<Undo2 className="size-5" aria-hidden />
								{mutations.cancel.isPending
									? "Cancelando..."
									: "Cancelar envio"}
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								disabled={busy}
								onClick={() =>
									mutations.approve.mutate({ contentId: id, version })
								}
								className={primary}
							>
								<CircleCheckBig className="size-5" aria-hidden />
								{mutations.approve.isPending ? "Aprovando..." : "Aprovar"}
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => setDecision("reject")}
								className={secondary}
							>
								<X className="size-5" aria-hidden />
								Recusar
							</button>
						</>
					)}
				</div>
			)}

			<DecisionSheet
				key={decision ?? "fechada"}
				mode={decision}
				busy={busy}
				error={decisionError ? errorMessage(decisionError) : null}
				onClose={() => {
					mutations.approve.reset();
					mutations.reject.reset();
					setDecision(null);
				}}
				onConfirm={(reason) => {
					const done = { onSuccess: () => setDecision(null) };
					if (decision === "reject") {
						mutations.reject.mutate(
							{
								contentId: id,
								version,
								...(reason !== undefined && { reason }),
							},
							done,
						);
					} else {
						mutations.approve.mutate(
							{
								contentId: id,
								version,
								...(reason !== undefined && { onBehalfReason: reason }),
							},
							done,
						);
					}
				}}
			/>

			<BottomSheet
				open={showHistory}
				title="Histórico da aprovação"
				onClose={() => setShowHistory(false)}
			>
				<div className="max-h-[60dvh] overflow-y-auto pb-2">
					{detail.data ? (
						<ApprovalHistory events={detail.data.history} />
					) : (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Carregando...
						</p>
					)}
				</div>
			</BottomSheet>
		</section>
	);
}

function StatusText({
	status,
	isAgency,
	request,
	changedSinceSubmit,
}: {
	status: ContentDto["approvalStatus"];
	isAgency: boolean;
	request: {
		submittedAt: string;
		decidedOnBehalf: boolean;
		reason: string | null;
	} | null;
	changedSinceSubmit: boolean;
}) {
	const text = "text-zinc-700 dark:text-zinc-300";
	switch (status) {
		case "in_preparation":
			return (
				<p className={text}>
					{isAgency
						? "A agência mexeu neste roteiro. Quando estiver pronto, envie para o cliente aprovar."
						: "A agência está preparando este roteiro."}
				</p>
			);
		case "pending":
			return (
				<div className="flex flex-col gap-1">
					<p className={text}>
						{isAgency
							? "Aguardando a aprovação do cliente"
							: "A agência enviou este roteiro para você aprovar"}
						{request && ` desde ${momentLabel(request.submittedAt)}`}.
					</p>
					{changedSinceSubmit && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							A agência atualizou o roteiro depois de enviar; esta é a versão
							atual.
						</p>
					)}
					{!isAgency && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Para pedir mudanças, recuse e conte o que mudar.
						</p>
					)}
				</div>
			);
		case "approved":
			return (
				<div className="flex flex-col gap-1">
					<p className={text}>
						{request?.decidedOnBehalf
							? "Aprovado pela agência em nome do cliente."
							: "Aprovado pelo cliente."}
					</p>
					{request?.decidedOnBehalf && request.reason && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Motivo: {request.reason}
						</p>
					)}
					{isAgency && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Se a agência mexer no roteiro, ele perde a aprovação.
						</p>
					)}
				</div>
			);
		case "rejected":
			return (
				<div className="flex flex-col gap-1">
					<p className={text}>Recusado pelo cliente.</p>
					{request?.reason && (
						<p className="text-sm text-zinc-700 dark:text-zinc-300">
							“{request.reason}”
						</p>
					)}
					{isAgency && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Ajuste o roteiro e envie de novo.
						</p>
					)}
				</div>
			);
		default:
			return null;
	}
}
