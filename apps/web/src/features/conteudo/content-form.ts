import type { ContentChanges, ContentDto } from "../../api/client";

/** Estado do formulário: campos de texto como string, vazio = sem valor. */
export type ContentForm = {
	title: string;
	idea: string;
	hook: string;
	body: string;
	cta: string;
	caption: string;
	mediaType: string;
	funnelStage: string;
	format: string;
	category: string;
	targetDurationSeconds: string;
};

export function toForm(content: ContentDto): ContentForm {
	return {
		title: content.title,
		idea: content.idea ?? "",
		hook: content.script.hook ?? "",
		body: content.script.body ?? "",
		cta: content.script.cta ?? "",
		caption: content.script.caption ?? "",
		mediaType: content.mediaType ?? "",
		funnelStage: content.funnelStage ?? "",
		format: content.format ?? "",
		category: content.category ?? "",
		targetDurationSeconds: content.targetDurationSeconds?.toString() ?? "",
	};
}

const textOrNull = (value: string) =>
	value.trim() === "" ? null : value.trim();

/** Só o que mudou, para não mexer no roteiro sem querer (mexida da agência exige aprovação, RN-203). */
export function diffForm(
	before: ContentForm,
	after: ContentForm,
): ContentChanges {
	const changes: ContentChanges = {};
	if (after.title.trim() !== before.title) changes.title = after.title.trim();
	const simple = ["idea", "format", "category"] as const;
	for (const key of simple) {
		if (after[key] !== before[key]) changes[key] = textOrNull(after[key]);
	}
	const script: NonNullable<ContentChanges["script"]> = {};
	for (const key of ["hook", "body", "cta", "caption"] as const) {
		if (after[key] !== before[key]) script[key] = textOrNull(after[key]);
	}
	if (Object.keys(script).length > 0) changes.script = script;
	if (after.mediaType !== before.mediaType) {
		changes.mediaType = (after.mediaType ||
			null) as ContentChanges["mediaType"];
	}
	if (after.funnelStage !== before.funnelStage) {
		changes.funnelStage = (after.funnelStage ||
			null) as ContentChanges["funnelStage"];
	}
	if (after.targetDurationSeconds !== before.targetDurationSeconds) {
		const seconds = Number.parseInt(after.targetDurationSeconds, 10);
		changes.targetDurationSeconds = Number.isNaN(seconds) ? null : seconds;
	}
	return changes;
}
