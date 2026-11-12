import { registerBulkCreateContents } from "./bulk-create-contents";
import { registerCreateContent } from "./create-content";
import type { RegisterContentTool } from "./deps";
import { registerDuplicateContent } from "./duplicate-content";
import { registerGetCalendar } from "./get-calendar";
import { registerGetContent } from "./get-content";
import { registerListContents } from "./list-contents";
import { registerMoveContent } from "./move-content";
import { registerScheduleContent } from "./schedule-content";
import { registerTrashTools } from "./trash";
import { registerUpdateContent } from "./update-content";

/** Ferramentas de cards, kanban e calendário (design §6, "Conteúdo"). */
export const registerContentTools: RegisterContentTool = (
	server,
	user,
	deps,
) => {
	for (const register of [
		registerListContents,
		registerGetContent,
		registerCreateContent,
		registerBulkCreateContents,
		registerUpdateContent,
		registerDuplicateContent,
		registerMoveContent,
		registerScheduleContent,
		registerGetCalendar,
		registerTrashTools,
	]) {
		register(server, user, deps);
	}
};
