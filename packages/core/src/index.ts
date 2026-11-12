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
export { resolveActorContext } from "./policies/permission.policy";
export type {
	ActorContext,
	ActorKind,
	ActorScope,
} from "./shared/actor-context";
export { DomainError, NotDecidedYet } from "./shared/domain-error";
