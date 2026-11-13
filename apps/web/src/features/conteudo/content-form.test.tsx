import { describe, expect, it } from "vitest";
import type { ContentDto } from "../../api/client";
import { diffForm, toForm } from "./content-form";

const content = {
	id: "c1",
	companyId: "co1",
	title: "Post",
	idea: null,
	script: { hook: "Gancho", body: null, cta: null, caption: null },
	mediaType: null,
	funnelStage: null,
	format: null,
	category: null,
	targetDurationSeconds: 30,
} as unknown as ContentDto;

describe("formulário do card", () => {
	it("sem mudanças, não envia nada", () => {
		const form = toForm(content);
		expect(diffForm(form, form)).toEqual({});
	});

	it("RN-203: só envia o roteiro quando ele muda", () => {
		const before = toForm(content);

		expect(diffForm(before, { ...before, title: "Novo" })).toEqual({
			title: "Novo",
		});
		expect(diffForm(before, { ...before, body: "Corpo" })).toEqual({
			script: { body: "Corpo" },
		});
	});

	it("campo apagado vira null e número é convertido", () => {
		const before = toForm(content);

		expect(
			diffForm(before, {
				...before,
				hook: "  ",
				targetDurationSeconds: "45",
				mediaType: "reel",
			}),
		).toEqual({
			script: { hook: null },
			targetDurationSeconds: 45,
			mediaType: "reel",
		});
	});
});
