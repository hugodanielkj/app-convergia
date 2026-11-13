import { DomainError } from "../shared/domain-error";
import { MAX_SCRIPTS_PER_CALL } from "./refinement";

/** 📎 RN-074: mensagem da regra de negócio §7. */
export function stalePreview(): DomainError {
	return new DomainError(
		"stale_preview",
		"O card mudou depois desta prévia. Gere uma nova.",
	);
}

/** Prévia já aplicada, descartada, substituída por uma mais nova ou de outro card. */
export function previewUnavailable(): DomainError {
	return new DomainError(
		"preview_unavailable",
		"Esta prévia não está mais disponível. Peça um novo refino.",
	);
}

/** 📎 RN-070. */
export function scriptBatchOutOfRange(): DomainError {
	return new DomainError(
		"invalid_input",
		`Gere roteiros para 1 a ${MAX_SCRIPTS_PER_CALL} cards por vez.`,
	);
}
