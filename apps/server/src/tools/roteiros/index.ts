import type { RegisterScriptTool } from "./deps";
import { registerScriptOptionTools } from "./generate-script-options";
import { registerGenerateScripts } from "./generate-scripts";
import { registerGetRefineChat } from "./get-refine-chat";
import { registerRefineContent } from "./refine-content";
import { registerReviewContentRefinement } from "./review-content-refinement";

/** Ferramentas de roteiro (design §6, "Roteiros"). */
export const registerScriptTools: RegisterScriptTool = (server, user, deps) => {
	for (const register of [
		registerGenerateScripts,
		...registerScriptOptionTools,
		registerRefineContent,
		registerGetRefineChat,
		registerReviewContentRefinement,
	]) {
		register(server, user, deps);
	}
};
