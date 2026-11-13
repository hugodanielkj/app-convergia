import { InMemoryContentRepository } from "../../conteudo/testing/in-memory-content-repository";
import { InMemoryApprovalRepository } from "./in-memory-approval-repository";

/** Cards e aprovações em memória, dividindo os dados como o banco faz. */
export function inMemoryContentDeps(now?: () => Date) {
	const contents = new InMemoryContentRepository(now);
	return { contents, approvals: new InMemoryApprovalRepository(contents) };
}
