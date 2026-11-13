import { DomainError } from "../shared/domain-error";

export function notPending(): DomainError {
	return new DomainError(
		"not_pending",
		"Este item não está aguardando aprovação.",
	);
}

/** 💡 design §5.3: o cliente nunca decide sobre uma versão que não viu. */
export function versionChanged(): DomainError {
	return new DomainError(
		"approval_version_changed",
		"O item foi atualizado pela agência. Revise a versão nova.",
	);
}

/** Outra pessoa mexeu no card entre a leitura e a gravação (design §9). */
export function contentChangedMeanwhile(): DomainError {
	return new DomainError(
		"content_conflict",
		"O card mudou enquanto você trabalhava nele. Abra de novo e tente outra vez.",
	);
}
