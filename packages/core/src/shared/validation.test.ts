import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseInput } from "./validation";

describe("parseInput", () => {
	it("devolve o valor válido", () => {
		expect(parseInput(z.object({ n: z.number() }), { n: 1 })).toEqual({ n: 1 });
	});

	it("explica em português qual campo está errado", () => {
		expect(() =>
			parseInput(z.object({ title: z.string().min(1) }), { title: "" }),
		).toThrow(/^Confira os dados enviados \(title\): .+\.$/);
	});
});
