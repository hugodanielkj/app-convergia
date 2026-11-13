export {
	API_KEY_PREFIX,
	generateApiKey,
	hashApiKey,
	isApiKeyFormat,
} from "./acesso/api-key";
export type { AuthenticatedUser } from "./acesso/authenticated-user";
export type {
	ApiKeyRepository,
	NewApiKey,
} from "./acesso/ports/api-key-repository";
export type {
	Company,
	CompanyRepository,
} from "./acesso/ports/company-repository";
export { authenticateApiKey } from "./acesso/use-cases/authenticate-api-key";
export {
	type IssuedApiKey,
	issueApiKey,
	MAX_ACTIVE_API_KEYS,
} from "./acesso/use-cases/issue-api-key";
export { listCompanies } from "./acesso/use-cases/list-companies";
export { type WhoamiResult, whoami } from "./acesso/use-cases/whoami";
export {
	APPROVAL_STATUSES,
	type ApprovalStatus,
	type CalendarRange,
	type Content,
	type ContentUpdateInput,
	calendarRangeInput,
	contentUpdateInput,
	FUNNEL_STAGES,
	type FunnelStage,
	KANBAN_STATUSES,
	type KanbanStatus,
	MAX_CALENDAR_DAYS,
	MEDIA_TYPES,
	type MediaType,
	type MoveContentInput,
	moveContentInput,
	type NewContentInput,
	newContentInput,
	plannedDateInput,
	SCRIPT_FIELDS,
	type Script,
} from "./conteudo/content";
export type {
	ContentPatch,
	ContentRepository,
	NewContent,
} from "./conteudo/ports/content-repository";
export {
	createContents,
	MAX_BULK_CONTENTS,
} from "./conteudo/use-cases/create-contents";
export {
	deleteContent,
	duplicateContent,
	moveContent,
	restoreContent,
	scheduleContent,
} from "./conteudo/use-cases/organize-content";
export {
	getCalendar,
	getContent,
	listContents,
	listDeletedContents,
} from "./conteudo/use-cases/read-contents";
export { updateContent } from "./conteudo/use-cases/update-content";
export type { QuotaRepository } from "./cotas/ports/quota-repository";
export { withQuota } from "./cotas/with-quota";
export { TRASH_RETENTION_DAYS } from "./policies/content.policy";
export {
	assertCanWrite,
	resolveActorContext,
} from "./policies/permission.policy";
export {
	DEFAULT_DAILY_QUOTAS,
	QUOTA_TIME_ZONE,
	type QuotaTool,
	quotaDay,
} from "./policies/quota.policy";
export type {
	AiCallMeta,
	RefineTurn,
	ScriptAi,
	ScriptBrief,
	WrittenScript,
} from "./roteiros/ports/script-ai";
export type { ScriptRepository } from "./roteiros/ports/script-repository";
export {
	MAX_SCRIPTS_PER_CALL,
	PREVIEW_DECISIONS,
	type PreviewDecision,
	type PreviewStatus,
	type RefineMessage,
	refineContentInput,
} from "./roteiros/refinement";
export type { ScriptDeps } from "./roteiros/use-cases/deps";
export { generateScripts } from "./roteiros/use-cases/generate-scripts";
export {
	getRefineChat,
	refineContent,
	reviewContentRefinement,
} from "./roteiros/use-cases/refine-content";
export type {
	ActorContext,
	ActorKind,
	ActorScope,
} from "./shared/actor-context";
export { DomainError, NotDecidedYet } from "./shared/domain-error";
export { parseInput } from "./shared/validation";
