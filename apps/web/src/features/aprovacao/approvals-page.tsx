import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleCheckBig, Send, Undo2, X } from "lucide-react";
import { useState } from "react";
import {
	type ApprovalItemDto,
	type ApprovalView,
	errorMessage,
} from "../../api/client";
import { approvalsQuery } from "../../api/queries";
import { EmptyState, ErrorState, SkeletonList } from "../../components/states";
import { cn } from "../../lib/cn";
import { ScriptPreview } from "../roteiros/script-preview";
import { type DecisionMode, DecisionSheet } from "./decision-sheet";
import { momentLabel } from "./labels";
import { useApprovalMutations } from "./mutations";

/** Abas da agência (design §13.2): enviados, para enviar, recusados e aprovados. */
const AGENCY_TABS: { view: ApprovalView; label: string; empty: string }[] = [
	{
		view: "pending",
		label: "Aguardando",
		empty: "Nenhum item aguardando o cliente.",
	},
	{
		view: "to_submit",
		label: "Para enviar",
		empty: "Nenhum item em preparo. Gere ou edite um roteiro para enviar.",
	},
	{
		view: "rejected",
		label: "Recusados",
		empty: "Nenhum item recusado.",
	},
	{
		view: "approved",
		label: "Aprovados",
		empty: "Nenhum item aprovado ainda.",
	},
];

const primary =
	"flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60";
const secondary =
	"flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-zinc-300 disabled:opacity-60 dark:ring-zinc-700";

type Decision = { mode: DecisionMode; item: ApprovalItemDto };

/** Tela Aprovações (design §13.2). O cliente decide; a agência acompanha e envia. */
export function ApprovalsPage({
	companyId,
	isAgency,
}: {
	companyId: string;
	isAgency: boolean;
}) {
	const [view, setView] = useState<ApprovalView>("pending");
	const current = isAgency ? view : "pending";
	const list = useQuery(approvalsQuery(companyId, current));
	const mutations = useApprovalMutations(companyId);
	const [decision, setDecision] = useState<Decision | null>(null);
	const tab = AGENCY_TABS.find((t) => t.view === current);

	const actionError =
		mutations.submit.error ??
		mutations.cancel.error ??
		(decision === null ? mutations.approve.error : null);
	const decisionError =
		decision?.mode === "reject"
			? mutations.reject.error
			: mutations.approve.error;
	const busy =
		mutations.submit.isPending ||
		mutations.cancel.isPending ||
		mutations.approve.isPending ||
		mutations.reject.isPending;

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-3xl font-medium">Aprovações</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					{isAgency
						? "Roteiros e ideias que a agência preparou para este cliente."
						: "Roteiros e ideias que a agência preparou para você aprovar."}
				</p>
			</div>

			{isAgency && (
				<div
					role="tablist"
					aria-label="Situação dos itens"
					className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
				>
					{AGENCY_TABS.map((t) => (
						<button
							key={t.view}
							type="button"
							role="tab"
							aria-selected={t.view === current}
							onClick={() => setView(t.view)}
							className={cn(
								"min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
								t.view === current
									? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
									: "bg-zinc-200/70 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
							)}
						>
							{t.label}
						</button>
					))}
				</div>
			)}

			{actionError && (
				<p
					role="alert"
					className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
				>
					{errorMessage(actionError)}
				</p>
			)}

			{list.isPending ? (
				<SkeletonList rows={3} />
			) : list.isError ? (
				<ErrorState
					message={errorMessage(list.error)}
					action={
						<button
							type="button"
							onClick={() => void list.refetch()}
							className="font-semibold underline"
						>
							Tentar de novo
						</button>
					}
				/>
			) : list.data.items.length === 0 ? (
				<EmptyState icon={CircleCheckBig} title="Nada por aqui">
					{isAgency
						? tab?.empty
						: "Quando a agência enviar um item para você aprovar, ele aparece aqui."}
				</EmptyState>
			) : (
				<ul className="flex flex-col gap-3">
					{list.data.items.map((item) => (
						<li key={item.content.id}>
							<ApprovalCard
								item={item}
								view={current}
								isAgency={isAgency}
								busy={busy}
								onSubmit={() => mutations.submit.mutate(item.content.id)}
								onCancel={() => mutations.cancel.mutate(item.content.id)}
								onApprove={() =>
									mutations.approve.mutate({
										contentId: item.content.id,
										version: item.content.contentVersion,
									})
								}
								onDecide={(mode) => {
									mutations.approve.reset();
									mutations.reject.reset();
									setDecision({ mode, item });
								}}
							/>
						</li>
					))}
				</ul>
			)}

			<DecisionSheet
				key={
					decision ? `${decision.mode}-${decision.item.content.id}` : "fechada"
				}
				itemType={decision?.item.content.approvalItemType ?? "script"}
				mode={decision?.mode ?? null}
				busy={busy}
				error={decisionError ? errorMessage(decisionError) : null}
				onClose={() => setDecision(null)}
				onConfirm={(reason) => {
					if (!decision) return;
					const contentId = decision.item.content.id;
					const version = decision.item.content.contentVersion;
					const done = { onSuccess: () => setDecision(null) };
					if (decision.mode === "reject") {
						mutations.reject.mutate(
							{ contentId, version, ...(reason !== undefined && { reason }) },
							done,
						);
					} else {
						mutations.approve.mutate(
							{
								contentId,
								version,
								...(reason !== undefined && { onBehalfReason: reason }),
							},
							done,
						);
					}
				}}
			/>
		</div>
	);
}

function ApprovalCard({
	item,
	view,
	isAgency,
	busy,
	onSubmit,
	onCancel,
	onApprove,
	onDecide,
}: {
	item: ApprovalItemDto;
	view: ApprovalView;
	isAgency: boolean;
	busy: boolean;
	onSubmit: () => void;
	onCancel: () => void;
	onApprove: () => void;
	onDecide: (mode: DecisionMode) => void;
}) {
	const { content, request } = item;
	const changed =
		view === "pending" &&
		request !== null &&
		content.contentVersion !== request.submittedVersion;

	return (
		<article className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
			<div className="flex flex-col gap-0.5">
				<Link
					to={
						content.approvalItemType === "idea"
							? "/empresas/$companyId/ideias"
							: "/empresas/$companyId/cards/$contentId"
					}
					params={{ companyId: content.companyId, contentId: content.id }}
					className="text-lg font-semibold underline-offset-2 hover:underline"
				>
					{content.title}
				</Link>
				<Meta view={view} item={item} />
				{changed && (
					<p className="text-sm text-zinc-600 dark:text-zinc-400">
						Atualizado pela agência depois do envio.
					</p>
				)}
				{(view === "rejected" ||
					(view === "approved" && request?.decidedOnBehalf)) &&
					request?.reason && (
						<p className="text-sm text-zinc-700 dark:text-zinc-300">
							“{request.reason}”
						</p>
					)}
			</div>

			{content.approvalItemType === "idea" ? (
				<div>
					<p className="whitespace-pre-wrap">{content.script.body}</p>
					<p className="text-sm">Por que funciona: {content.script.caption}</p>
				</div>
			) : (
				!isAgency && <ScriptPreview script={content.script} />
			)}

			{!isAgency && view === "pending" && (
				<div className="flex gap-2">
					<button
						type="button"
						disabled={busy}
						onClick={onApprove}
						className={primary}
					>
						<CircleCheckBig className="size-4" aria-hidden />
						Aprovar
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => onDecide("reject")}
						className={secondary}
					>
						<X className="size-4" aria-hidden />
						Recusar
					</button>
				</div>
			)}

			{isAgency && view === "pending" && (
				<div className="flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						disabled={busy}
						onClick={() => onDecide("approve_on_behalf")}
						className={primary}
					>
						<CircleCheckBig className="size-4" aria-hidden />
						Aprovar em nome do cliente
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={onCancel}
						className={secondary}
					>
						<Undo2 className="size-4" aria-hidden />
						Cancelar envio
					</button>
				</div>
			)}

			{isAgency && view === "to_submit" && (
				<button
					type="button"
					disabled={busy}
					onClick={onSubmit}
					className={primary}
				>
					<Send className="size-4" aria-hidden />
					Enviar para aprovação
				</button>
			)}

			{isAgency && view === "rejected" && (
				<Link
					to={
						content.approvalItemType === "idea"
							? "/empresas/$companyId/ideias"
							: "/empresas/$companyId/cards/$contentId"
					}
					params={{ companyId: content.companyId, contentId: content.id }}
					className={secondary}
				>
					Revisar conteúdo
				</Link>
			)}
		</article>
	);
}

function Meta({ view, item }: { view: ApprovalView; item: ApprovalItemDto }) {
	const { request, content } = item;
	const text = (() => {
		if (view === "to_submit")
			return `Mexido em ${momentLabel(content.updatedAt)}`;
		if (!request) return null;
		if (view === "pending")
			return `Enviado em ${momentLabel(request.submittedAt)}`;
		if (!request.decidedAt) return null;
		const when = momentLabel(request.decidedAt);
		if (view === "rejected") return `Recusado em ${when}`;
		return request.decidedOnBehalf
			? `Aprovado pela agência em nome do cliente em ${when}`
			: `Aprovado pelo cliente em ${when}`;
	})();
	return text ? (
		<span className="text-sm text-zinc-600 dark:text-zinc-400">{text}</span>
	) : null;
}
