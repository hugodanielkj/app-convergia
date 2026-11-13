/** Datas de calendário como texto AAAA-MM-DD, no fuso do aparelho (a data só organiza, RN-062). */

export function toIsoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function fromIsoDate(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
	const date = fromIsoDate(iso);
	date.setDate(date.getDate() + days);
	return toIsoDate(date);
}

/** Segunda-feira da semana de `iso`, como no calendário brasileiro de trabalho. */
export function startOfWeek(iso: string): string {
	const weekday = (fromIsoDate(iso).getDay() + 6) % 7;
	return addDays(iso, -weekday);
}

export function weekDays(start: string): string[] {
	return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
	weekday: "long",
	day: "numeric",
	month: "short",
});
const shortFormat = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
});

/** Ex.: "Segunda-feira, 16 de nov." */
export function dayLabel(iso: string): string {
	const label = dayFormat.format(fromIsoDate(iso));
	return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Ex.: "16 de nov." */
export function shortDate(iso: string): string {
	return shortFormat.format(fromIsoDate(iso));
}

/** Ex.: "16 de nov. – 22 de nov." */
export function weekLabel(start: string): string {
	return `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;
}

export function todayIso(): string {
	return toIsoDate(new Date());
}
