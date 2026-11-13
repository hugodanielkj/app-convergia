/** Dublês das portas, só para testes dos outros pacotes. */

export { InMemoryApiKeyRepository } from "./acesso/testing/in-memory-api-key-repository";
export { InMemoryCompanyRepository } from "./acesso/testing/in-memory-company-repository";
export { inMemoryContentDeps } from "./aprovacao/testing/content-deps";
export { InMemoryApprovalRepository } from "./aprovacao/testing/in-memory-approval-repository";
export { InMemoryContentRepository } from "./conteudo/testing/in-memory-content-repository";
export { InMemoryQuotaRepository } from "./cotas/testing/in-memory-quota-repository";
export {
	FakeDiscoveryQueue,
	FakeQueryExpander,
	FakeVideoProvider,
	testDiscoveryDeps,
	testVideo,
} from "./descoberta/testing/fakes";
export { InMemoryDiscoveryRepository } from "./descoberta/testing/in-memory-discovery-repository";
export { FakeBrainstormAi, InMemoryIdeaRepository } from "./ideias/testing";
export {
	InMemoryKnowledgeRepository,
	InMemorySourceRepository,
} from "./referencias/testing";
export { FakeScriptAi } from "./roteiros/testing/fake-script-ai";
export { InMemoryScriptRepository } from "./roteiros/testing/in-memory-script-repository";
