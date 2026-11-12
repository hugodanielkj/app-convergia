import { plannedDateInput, scheduleContent } from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentIdInput, contentResult } from "./format";

export const registerScheduleContent: RegisterContentTool = (
	server,
	user,
	deps,
) => {
	registerCompanyTool(
		server,
		user,
		deps,
		"schedule_content",
		{
			title: "Planejar data do card",
			description:
				"Coloca o card numa data do calendário. A data só organiza o planejamento: nada é publicado no Instagram (RN-062).",
			input: {
				...contentIdInput,
				planned_date: plannedDateInput.describe("Data no formato AAAA-MM-DD"),
			},
		},
		async (actor, input) =>
			contentResult(
				"Data planejada.",
				await scheduleContent(
					deps,
					actor,
					input.content_id,
					input.planned_date,
				),
			),
	);
	registerCompanyTool(
		server,
		user,
		deps,
		"unschedule_content",
		{
			title: "Tirar card do calendário",
			description:
				"Remove a data planejada do card. O card continua no kanban.",
			input: contentIdInput,
		},
		async (actor, input) =>
			contentResult(
				"Data removida.",
				await scheduleContent(deps, actor, input.content_id, null),
			),
	);
};
