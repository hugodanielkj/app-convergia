import { NotDecidedYet } from "../shared/domain-error";
/** RN-066, RN-067, RN-300: nenhuma extração nem upload pago sem cota definida. */
export function sourceDailyLimit(): never {
	throw new NotDecidedYet("Q-21");
}
