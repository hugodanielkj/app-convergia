import { NotDecidedYet } from "../shared/domain-error";
/** RN-093: o usuário adiou o limite de criadores. Nenhum limite é presumido. */
export function referenceCreatorLimit(): never {
	throw new NotDecidedYet("Q-17");
}
/** RN-300, RN-303: salvar referência e analisar criador ainda não têm cota decidida. */
export function referenceDailyLimit(): never {
	throw new NotDecidedYet("Q-21");
}
