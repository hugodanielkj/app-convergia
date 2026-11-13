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
	APPROVAL_EVENT_TYPES,
	APPROVAL_ITEM_TYPES,
	APPROVAL_REQUEST_STATUSES,
	APPROVAL_VIEWS,
	type ApprovalEvent,
	type ApprovalEventDraft,
	type ApprovalEventType,
	type ApprovalItem,
	type ApprovalRequest,
	type ApprovalRequestStatus,
	type ApprovalView,
	type ApproveInput,
	approveInput,
	type RejectInput,
	rejectInput,
} from "./aprovacao/approval";
export type { ApprovalRepository } from "./aprovacao/ports/approval-repository";
export {
	type ApprovalDeps,
	type ApprovalDetail,
	approveItem,
	cancelApprovalRequest,
	getApprovalItem,
	listApprovalItems,
	rejectItem,
	submitForApproval,
} from "./aprovacao/use-cases/approvals";
export {
	APPROVAL_STATUSES,
	type ApprovalStatus,
	type CalendarRange,
	type Citation,
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
	type ScriptField,
} from "./conteudo/content";
export type {
	ContentChange,
	ContentPatch,
	ContentRepository,
	NewContent,
} from "./conteudo/ports/content-repository";
export * from "./conteudo/source";
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
export * from "./conteudo/use-cases/sources";
export { updateContent } from "./conteudo/use-cases/update-content";
export type { QuotaRepository } from "./cotas/ports/quota-repository";
export { withQuota } from "./cotas/with-quota";
export { NOT_CONFIGURED_MESSAGE, searchNotFound } from "./descoberta/errors";
export type { DiscoveryQueue } from "./descoberta/ports/discovery-queue";
export type {
	CacheStatus,
	CompletedRun,
	DiscoveryRepository,
	PlatformOutcome,
	QueryStatus,
	SearchRequest,
	VideoQuery,
} from "./descoberta/ports/discovery-repository";
export type { QueryExpander } from "./descoberta/ports/query-expander";
export {
	PROVIDER_ERROR_KINDS,
	type ProviderErrorKind,
	type ProviderSearchPage,
	type ProviderSearchRequest,
	type VideoProvider,
	VideoProviderError,
} from "./descoberta/ports/video-provider";
export {
	cacheKey,
	cleanQuery,
	matchScore,
	normalizeQuery,
	queryLanguage,
	STRATEGY_VERSION,
} from "./descoberta/query";
export {
	isGrowing,
	popularityByPlatform,
	type QueryResult,
	type RankedVideo,
	rankVideos,
} from "./descoberta/ranking";
export {
	DEFAULT_DISCOVERY_SETTINGS,
	type DiscoverySettings,
} from "./descoberta/settings";
export type { DiscoveryDeps } from "./descoberta/use-cases/deps";
export {
	discoverVideos,
	getVideoSearch,
} from "./descoberta/use-cases/discover-videos";
export { runVideoQuery } from "./descoberta/use-cases/run-video-query";
export type {
	PlatformStatus,
	SearchStatus,
	VideoSearchView,
} from "./descoberta/use-cases/view";
export {
	type CatalogVideo,
	type CollectedVideo,
	type MetricObservation,
	PLATFORM_FILTERS,
	type PlatformFilter,
	POPULAR_LABEL,
	SEARCH_PERIODS,
	SEARCH_SORTS,
	type SearchPeriod,
	type SearchSort,
	VIDEO_PLATFORMS,
	type VideoMetrics,
	type VideoPlatform,
	type VideoSearchInput,
	videoSearchInput,
	videoSearchPageInput,
} from "./descoberta/video";
export {
	brainstormInput,
	type Idea,
	type IdeaDraft,
	ideaApprovalSubject,
	ideaDraftSchema,
} from "./ideias/idea";
export type { BrainstormAi, IdeaRepository } from "./ideias/ports";
export * from "./ideias/use-cases";
export { TRASH_RETENTION_DAYS } from "./policies/content.policy";
export { assertIdeaCanBecomeCard } from "./policies/ideas.policy";
export {
	assertCanWrite,
	resolveActorContext,
} from "./policies/permission.policy";
export {
	DEFAULT_DAILY_QUOTAS,
	OPTION_QUOTA_TOOLS,
	QUOTA_TIME_ZONE,
	type QuotaKey,
	type QuotaTool,
	quotaDay,
	quotaExhausted,
	type UserQuotaTool,
	userQuotaKey,
} from "./policies/quota.policy";
export * from "./referencias/knowledge";
export * from "./referencias/processing";
export * from "./referencias/run-reference-job";
export * from "./referencias/use-cases";
export { HISTORY_LIMIT, type HistoryEntry } from "./roteiros/history";
export type {
	AiCallMeta,
	Refinement,
	RefineTurn,
	ScriptAi,
	ScriptBrief,
	WrittenScript,
} from "./roteiros/ports/script-ai";
export type { ScriptRepository } from "./roteiros/ports/script-repository";
export {
	citationKey,
	MAX_OPTIONS_PER_CALL,
	MAX_SCRIPTS_PER_CALL,
	mergeCitations,
	PREVIEW_DECISIONS,
	type PreviewDecision,
	type PreviewStatus,
	type RefineMessage,
	refineContentInput,
	type ScriptOptions,
	scriptOptionsInput,
} from "./roteiros/refinement";
export type { ScriptDeps } from "./roteiros/use-cases/deps";
export { generateScriptOptions } from "./roteiros/use-cases/generate-script-options";
export { generateScripts } from "./roteiros/use-cases/generate-scripts";
export { listContentGenerations } from "./roteiros/use-cases/list-content-generations";
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
