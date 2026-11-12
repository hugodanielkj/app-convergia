import { DomainError } from "../shared/domain-error";

/** RN-015: também para card de outra empresa ou na lixeira, sem revelar que existe. */
export function contentNotFound(): DomainError {
	return new DomainError("content_not_found", "Card não encontrado.");
}
