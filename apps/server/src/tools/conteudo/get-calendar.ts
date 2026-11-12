import {
	calendarRangeInput,
	getCalendar,
	MAX_CALENDAR_DAYS,
} from "@convergia/core";
import { registerCompanyTool } from "../company-tool";
import type { RegisterContentTool } from "./deps";
import { contentListResult } from "./format";

export const registerGetCalendar: RegisterContentTool = (server, user, deps) =>
	registerCompanyTool(
		server,
		user,
		deps,
		"get_calendar",
		{
			title: "Calendário editorial",
			description: `Lista os cards com data planejada entre duas datas (AAAA-MM-DD), em um intervalo de até ${MAX_CALENDAR_DAYS} dias. Não consome cota.`,
			input: { range: calendarRangeInput.describe("Intervalo: { from, to }") },
			readOnly: true,
		},
		async (actor, input) =>
			contentListResult(
				"Nenhum card planejado nesse intervalo.",
				await getCalendar(deps, actor, input.range),
			),
	);
