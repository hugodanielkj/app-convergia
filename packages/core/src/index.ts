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
export { authenticateApiKey } from "./acesso/use-cases/authenticate-api-key";
export {
	type IssuedApiKey,
	issueApiKey,
	MAX_ACTIVE_API_KEYS,
} from "./acesso/use-cases/issue-api-key";
export { type WhoamiResult, whoami } from "./acesso/use-cases/whoami";
export { buildActorContext } from "./policies/permission.policy";
export type {
	ActorContext,
	ActorKind,
	ActorScope,
} from "./shared/actor-context";
export { DomainError, NotDecidedYet } from "./shared/domain-error";
