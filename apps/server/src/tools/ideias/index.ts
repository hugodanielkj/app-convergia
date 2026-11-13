import { registerAcceptBrainstormSuggestion } from "./accept-brainstorm-suggestion";
import type { RegisterIdeaTool } from "./deps";
import { registerDismissBrainstormSuggestion } from "./dismiss-brainstorm-suggestion";
import { registerListBrainstormSuggestions } from "./list-brainstorm-suggestions";
import { registerRegenerateBrainstorm } from "./regenerate-brainstorm";
export const registerIdeaTools: RegisterIdeaTool = (server, user, deps) => {
	registerListBrainstormSuggestions(server, user, deps);
	registerRegenerateBrainstorm(server, user, deps);
	registerAcceptBrainstormSuggestion(server, user, deps);
	registerDismissBrainstormSuggestion(server, user, deps);
};
