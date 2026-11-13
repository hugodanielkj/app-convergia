import { DomainError, NotDecidedYet } from "@convergia/core";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
	InvalidCredentialError,
	MissingCredentialError,
} from "../auth/authenticate";

const UNEXPECTED_ERROR =
	"Ocorreu um erro inesperado. Tente de novo em instantes.";

const STATUS_BY_CODE: Record<string, ContentfulStatusCode> = {
	no_access: 403,
	idea_not_found: 404,
	reference_not_found: 404,
	reference_provider_unavailable: 503,
	reference_queue_unavailable: 503,
	reference_not_ready: 409,
	creator_limit: 409,
	source_not_found: 404,
	idea_changed: 409,
	idea_not_approved: 409,
	idea_inactive: 409,
	company_required: 400,
	quota_exhausted: 429,
	rate_limited: 429,
	search_not_found: 404,
	stale_preview: 409,
	content_conflict: 409,
	approval_version_changed: 409,
	not_pending: 409,
	already_pending: 409,
	preview_unavailable: 409,
	ai_unavailable: 503,
};

export type AppErrorBody = {
	error: string;
	message: string;
	questionId?: string;
};

/** Erro da API do app: o app mostra `message` como veio (regra de negócio §7). */
export function toAppError(error: unknown): {
	status: ContentfulStatusCode;
	body: AppErrorBody;
} {
	if (
		error instanceof MissingCredentialError ||
		error instanceof InvalidCredentialError
	) {
		return {
			status: 401,
			body: { error: "unauthorized", message: error.message },
		};
	}
	if (error instanceof DomainError) {
		return {
			status: STATUS_BY_CODE[error.code] ?? 422,
			body: { error: error.code, message: error.message },
		};
	}
	if (error instanceof NotDecidedYet) {
		return {
			status: 501,
			body: {
				error: "not_decided_yet",
				message: `Esta funcionalidade depende de uma regra ainda não definida (${error.questionId}).`,
				questionId: error.questionId,
			},
		};
	}
	console.error(error);
	return {
		status: 500,
		body: { error: "unexpected", message: UNEXPECTED_ERROR },
	};
}
