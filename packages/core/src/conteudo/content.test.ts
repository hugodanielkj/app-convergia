import { describe, expect, it } from "vitest";
import {
	calendarRangeInput,
	contentUpdateInput,
	newContentInput,
} from "./content";

describe("entrada de cards", () => {
	it("exige título e apara espaços", () => {
		expect(newContentInput.safeParse({ title: "   " }).success).toBe(false);
		expect(newContentInput.parse({ title: "  Post  " }).title).toBe("Post");
	});

	it("aceita data só no formato AAAA-MM-DD", () => {
		expect(
			newContentInput.safeParse({ title: "x", plannedDate: "2026-11-20" })
				.success,
		).toBe(true);
		expect(
			newContentInput.safeParse({ title: "x", plannedDate: "20/11/2026" })
				.success,
		).toBe(false);
	});

	it("permite limpar um campo com null", () => {
		expect(
			contentUpdateInput.parse({ idea: null, script: { hook: null } }),
		).toEqual({
			idea: null,
			script: { hook: null },
		});
	});

	it("limita o calendário a 92 dias", () => {
		expect(
			calendarRangeInput.safeParse({ from: "2026-11-01", to: "2027-01-31" })
				.success,
		).toBe(true);
		expect(
			calendarRangeInput.safeParse({ from: "2026-11-01", to: "2027-02-05" })
				.success,
		).toBe(false);
		expect(
			calendarRangeInput.safeParse({ from: "2026-11-10", to: "2026-11-01" })
				.success,
		).toBe(false);
	});
});
