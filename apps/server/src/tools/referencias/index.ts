import { registerAddContentSource } from "./add-content-source";
import { registerAttachContentReference } from "./attach-content-reference";
import { registerCreateContentFromSource } from "./create-content-from-source";
import { registerCreateContentSourceUpload } from "./create-content-source-upload";
import { registerDeleteSavedReference } from "./delete-saved-reference";
import type { RegisterKnowledgeTool } from "./deps";
import { registerDetachContentReference } from "./detach-content-reference";
import { registerGetContentSource } from "./get-content-source";
import { registerGetCreatorAnalysis } from "./get-creator-analysis";
import { registerListContentReferences } from "./list-content-references";
import { registerListSavedReferences } from "./list-saved-references";
import { registerRetryContentSource } from "./retry-content-source";
import { registerRunCreatorDeepAnalysis } from "./run-creator-deep-analysis";
import { registerSaveReferenceByUrl } from "./save-reference-by-url";
export const registerKnowledgeTools: RegisterKnowledgeTool = (
	server,
	user,
	deps,
) => {
	registerCreateContentFromSource(server, user, deps);
	registerCreateContentSourceUpload(server, user, deps);
	registerRetryContentSource(server, user, deps);
	registerAddContentSource(server, user, deps);
	registerListSavedReferences(server, user, deps);
	registerSaveReferenceByUrl(server, user, deps);
	registerDeleteSavedReference(server, user, deps);
	registerGetCreatorAnalysis(server, user, deps);
	registerRunCreatorDeepAnalysis(server, user, deps);
	registerListContentReferences(server, user, deps);
	registerAttachContentReference(server, user, deps);
	registerDetachContentReference(server, user, deps);
	registerGetContentSource(server, user, deps);
};
