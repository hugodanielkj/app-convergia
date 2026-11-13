import type { ApprovalStatus, Content } from "../../conteudo/content";
import type { ContentRepository } from "../../conteudo/ports/content-repository";
import { getContent } from "../../conteudo/use-cases/read-contents";
import {
	approvalDecision,
	assertCanCancel,
	assertCanReject,
	assertCanSubmit,
	creatorKind,
} from "../../policies/approval.policy";
import { assertCanWrite } from "../../policies/permission.policy";
import type { ActorContext } from "../../shared/actor-context";
import type {
	ApprovalEvent,
	ApprovalItem,
	ApprovalRequest,
	ApprovalView,
	ApproveInput,
	RejectInput,
} from "../approval";
import { contentChangedMeanwhile, versionChanged } from "../errors";
import type { ApprovalRepository } from "../ports/approval-repository";

export type ApprovalDeps = {
	contents: ContentRepository;
	approvals: ApprovalRepository;
	now: () => Date;
	approvalSubjects?: ContentRepository;
};

/** Estado do roteiro em cada lista (design §6, "Aprovação"). */
const STATUSES_BY_VIEW: Record<ApprovalView, ApprovalStatus> = {
	pending: "pending",
	// list_items_to_submit: novos, cancelados, ajustados depois de recusados ou que perderam a aprovação.
	to_submit: "in_preparation",
	rejected: "rejected",
	approved: "approved",
};

/** RN-210: a agência envia o roteiro em preparo; o cliente passa a ver esta versão. */
export async function submitForApproval(
	deps: ApprovalDeps,
	actor: ActorContext,
	contentId: string,
): Promise<ApprovalItem> {
	assertCanWrite(actor);
	const content = await loadApprovalSubject(deps, actor, contentId);
	assertCanSubmit(actor, content);
	const request = await deps.approvals.submit(actor.companyId, {
		contentId: content.id,
		itemType: content.approvalItemType ?? "script",
		expect: {
			contentVersion: content.contentVersion,
			approvalStatus: content.approvalStatus,
		},
		snapshot: content.script,
		event: eventBy(actor, "submitted"),
		at: deps.now(),
	});
	if (!request) throw contentChangedMeanwhile();
	return {
		content: await loadApprovalSubject(deps, actor, contentId),
		request,
	};
}

/** RN-218: o envio cancelado volta para a agência como se não tivesse sido enviado. */
export async function cancelApprovalRequest(
	deps: ApprovalDeps,
	actor: ActorContext,
	contentId: string,
): Promise<ApprovalItem> {
	assertCanWrite(actor);
	const content = await loadApprovalSubject(deps, actor, contentId);
	assertCanCancel(actor, content);
	return decide(deps, actor, content, {
		expectVersion: null,
		outcome: "cancelled",
		contentStatus: "in_preparation",
		onBehalf: false,
		reason: null,
		event: eventBy(actor, "cancelled"),
	});
}

/** RN-211: o cliente aprova. RN-214: a agência aprova em nome dele, com motivo. */
export async function approveItem(
	deps: ApprovalDeps,
	actor: ActorContext,
	contentId: string,
	input: ApproveInput,
): Promise<ApprovalItem> {
	assertCanWrite(actor);
	const content = await loadApprovalSubject(deps, actor, contentId);
	const { onBehalf, reason } = approvalDecision(
		actor,
		content,
		input.onBehalfReason,
	);
	assertSameVersion(content, input.version);
	return decide(deps, actor, content, {
		expectVersion: input.version,
		outcome: "approved",
		contentStatus: "approved",
		onBehalf,
		reason,
		event: eventBy(actor, onBehalf ? "approved_on_behalf" : "approved"),
	});
}

/** RN-212: o cliente recusa, com motivo opcional, e o roteiro volta para a agência. */
export async function rejectItem(
	deps: ApprovalDeps,
	actor: ActorContext,
	contentId: string,
	input: RejectInput,
): Promise<ApprovalItem> {
	assertCanWrite(actor);
	const content = await loadApprovalSubject(deps, actor, contentId);
	assertCanReject(actor, content);
	assertSameVersion(content, input.version);
	return decide(deps, actor, content, {
		expectVersion: input.version,
		outcome: "rejected",
		contentStatus: "rejected",
		onBehalf: false,
		reason: input.reason ?? null,
		event: eventBy(actor, "rejected"),
	});
}

/** Os cards de uma lista da tela de aprovações, com a solicitação vigente de cada um. */
export async function listApprovalItems(
	deps: ApprovalDeps,
	actor: ActorContext,
	view: ApprovalView,
): Promise<ApprovalItem[]> {
	const contents = await (deps.approvalSubjects ?? deps.contents).listActive(
		actor.companyId,
		{
			approvalStatuses: [STATUSES_BY_VIEW[view]],
		},
	);
	const requests = await deps.approvals.findMany(
		actor.companyId,
		contents.flatMap((c) =>
			c.currentApprovalRequestId ? [c.currentApprovalRequestId] : [],
		),
	);
	const byId = new Map(requests.map((r) => [r.id, r]));
	const items = contents.map((content) => ({
		content,
		request: content.currentApprovalRequestId
			? (byId.get(content.currentApprovalRequestId) ?? null)
			: null,
	}));
	// O que espera há mais tempo primeiro; sem envio, o mexido há mais tempo.
	return items.sort(
		(a, b) =>
			(a.request?.submittedAt ?? a.content.updatedAt).getTime() -
			(b.request?.submittedAt ?? b.content.updatedAt).getTime(),
	);
}

export type ApprovalDetail = ApprovalItem & {
	/** ✅ RN-216: a agência mudou o roteiro depois de enviar. */
	changedSinceSubmit: boolean;
	history: ApprovalEvent[];
};

/** O roteiro, a solicitação vigente e o histórico (RN-216, RN-230). */
export async function getApprovalItem(
	deps: ApprovalDeps,
	actor: ActorContext,
	contentId: string,
): Promise<ApprovalDetail> {
	const content = await loadApprovalSubject(deps, actor, contentId);
	const [request] = content.currentApprovalRequestId
		? await deps.approvals.findMany(actor.companyId, [
				content.currentApprovalRequestId,
			])
		: [];
	return {
		content,
		request: request ?? null,
		changedSinceSubmit:
			request?.status === "pending" &&
			content.contentVersion !== request.submittedVersion,
		history: await deps.approvals.listEvents(actor.companyId, content.id),
	};
}

async function decide(
	deps: ApprovalDeps,
	actor: ActorContext,
	content: Content,
	decision: Pick<
		Parameters<ApprovalRepository["decide"]>[1],
		| "expectVersion"
		| "outcome"
		| "contentStatus"
		| "onBehalf"
		| "reason"
		| "event"
	>,
): Promise<ApprovalItem> {
	const requestId = content.currentApprovalRequestId;
	if (!requestId) throw contentChangedMeanwhile();
	const request: ApprovalRequest | null = await deps.approvals.decide(
		actor.companyId,
		{
			contentId: content.id,
			itemType: content.approvalItemType ?? "script",
			requestId,
			...decision,
			at: deps.now(),
		},
	);
	if (!request) {
		// A agência mexeu no roteiro ou outra pessoa decidiu primeiro.
		const current = await loadApprovalSubject(deps, actor, content.id);
		throw current.approvalStatus === "pending"
			? versionChanged()
			: contentChangedMeanwhile();
	}
	return {
		content: await loadApprovalSubject(deps, actor, content.id),
		request,
	};
}

function assertSameVersion(content: Content, seen: number): void {
	if (content.contentVersion !== seen) throw versionChanged();
}

function eventBy<T extends ApprovalEvent["type"]>(
	actor: ActorContext,
	type: T,
) {
	return { type, actorId: actor.userId, actorKind: creatorKind(actor) };
}

function loadApprovalSubject(
	deps: ApprovalDeps,
	actor: ActorContext,
	id: string,
) {
	return getContent(
		{ ...deps, contents: deps.approvalSubjects ?? deps.contents },
		actor,
		id,
	);
}
