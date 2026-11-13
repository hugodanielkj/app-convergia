import { InMemoryContentRepository } from "../../conteudo/testing/in-memory-content-repository";
import { FakeBrainstormAi, InMemoryIdeaRepository } from "../../ideias/testing";
import {
	InMemoryKnowledgeRepository,
	InMemorySourceRepository,
} from "../../referencias/testing";
import { InMemoryApprovalRepository } from "./in-memory-approval-repository";

/** Cards e aprovações em memória, dividindo os dados como o banco faz. */
export function inMemoryContentDeps(now?: () => Date) {
	const contents = new InMemoryContentRepository(now);
	return {
		contents,
		approvals: new InMemoryApprovalRepository(contents),
		ideas: new InMemoryIdeaRepository(contents),
		brainstormAi: new FakeBrainstormAi(),
		knowledge: new InMemoryKnowledgeRepository(),
		sources: new InMemorySourceRepository(),
	};
}
