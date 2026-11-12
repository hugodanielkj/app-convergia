import { describe, expect, it } from "vitest";
import { addDays, dayLabel, startOfWeek, weekDays, weekLabel } from "./dates";

describe("datas do calendário", () => {
	it("a semana começa na segunda-feira", () => {
		expect(startOfWeek("2026-11-12")).toBe("2026-11-09");
		expect(startOfWeek("2026-11-15")).toBe("2026-11-09");
		expect(startOfWeek("2026-11-16")).toBe("2026-11-16");
	});

	it("soma dias atravessando o mês", () => {
		expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
	});

	it("lista os sete dias da semana", () => {
		expect(weekDays("2026-11-09")).toEqual([
			"2026-11-09",
			"2026-11-10",
			"2026-11-11",
			"2026-11-12",
			"2026-11-13",
			"2026-11-14",
			"2026-11-15",
		]);
	});

	it("escreve as datas em português", () => {
		expect(dayLabel("2026-11-16")).toMatch(/^Segunda-feira, 16 de nov/);
		expect(weekLabel("2026-11-09")).toMatch(/9 de nov.* – 15 de nov/);
	});
});
