import type { Content } from "../../conteudo/content";
import { getContent } from "../../conteudo/use-cases/read-contents";
import { withQuota } from "../../cotas/with-quota";
import { assertCanEditContent } from "../../policies/approval.policy";
import { assertCanWrite } from "../../policies/permission.policy";
import type { ActorContext } from "../../shared/actor-context";
import { scriptBatchOutOfRange } from "../errors";
import { MAX_SCRIPTS_PER_CALL } from "../refinement";
import { briefFor, type ScriptDeps, scriptChange } from "./deps";

/**
 * Gera o roteiro completo (gancho, corpo, CTA e legenda) de 1 a 5 cards (📎 RN-070) e grava
 * no card e no histórico (RN-072). Uma chamada reserva uma unidade da cota (design §8.1).
 * Se a IA falhar em qualquer card, nada é gravado e a cota volta (✅ RN-305).
 */
export async function generateScripts(
	deps: ScriptDeps,
	actor: ActorContext,
	contentIds: string[],
): Promise<Content[]> {
	assertCanWrite(actor);
	const ids = [...new Set(contentIds)];
	if (ids.length < 1 || ids.length > MAX_SCRIPTS_PER_CALL) {
		throw scriptBatchOutOfRange();
	}
	const cards: Content[] = [];
	for (const id of ids) {
		const content = await getContent(deps, actor, id);
		assertCanEditContent(actor, content.approvalStatus);
		cards.push(content);
	}
	const briefs = await Promise.all(
		cards.map((content) => briefFor(deps, actor, content)),
	);

	const written = await withQuota(deps, actor, "generate_scripts", () =>
		Promise.all(
			briefs.map((brief) =>
				deps.scriptAi.writeScript(
					{ companyId: actor.companyId, tool: "generate_scripts" },
					brief,
				),
			),
		),
	);

	const updated: Content[] = [];
	for (const [index, content] of cards.entries()) {
		const script = written[index];
		if (!script) throw new Error("A IA devolveu menos roteiros que cards.");
		updated.push(
			await deps.contents.update(
				actor.companyId,
				content.id,
				scriptChange(actor, content, script),
			),
		);
		await deps.scripts.addGeneration(actor.companyId, {
			contentId: content.id,
			script,
			createdByUserId: actor.userId,
		});
	}
	return updated;
}
