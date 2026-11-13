import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type RefineMessageDto, type ScriptField } from "../../api/client";
import { contentsKey, historyQuery, refineChatQuery } from "../../api/queries";

/** Gerar e refinar o roteiro de um card. Toda mudança recarrega o card e as listas. */
export function useScriptMutations(companyId: string) {
	const queryClient = useQueryClient();
	const refreshContents = () =>
		queryClient.invalidateQueries({ queryKey: contentsKey(companyId) });
	const param = (contentId: string) => ({ companyId, contentId });

	return {
		generate: useMutation({
			mutationFn: (contentId: string) => api.generateScript(param(contentId)),
			onSuccess: refreshContents,
		}),
		// 📎 RN-071: só sugere; o card muda quando a pessoa salva a opção escolhida.
		options: useMutation({
			mutationFn: ({
				contentId,
				field,
			}: {
				contentId: string;
				field: ScriptField;
			}) => api.scriptOptions(param(contentId), field),
			// As opções entram no histórico do card (RN-072).
			onSuccess: (_, { contentId }) =>
				queryClient.invalidateQueries({
					queryKey: historyQuery(companyId, contentId).queryKey,
				}),
		}),
		refine: useMutation({
			mutationFn: ({
				contentId,
				message,
			}: {
				contentId: string;
				message: string;
			}) => api.refine(param(contentId), message),
			onSuccess: ({ messages }, { contentId }) => {
				// Mostra a resposta na hora; prévias antigas mudam de estado no servidor.
				queryClient.setQueryData(
					refineChatQuery(companyId, contentId).queryKey,
					(old) => ({
						messages: [
							...(old?.messages ?? []).map(
								(m): RefineMessageDto =>
									m.previewStatus === "pending"
										? { ...m, previewStatus: "discarded" }
										: m,
							),
							...messages,
						],
					}),
				);
			},
		}),
		review: useMutation({
			mutationFn: ({
				contentId,
				messageId,
				decision,
			}: {
				contentId: string;
				messageId: string;
				decision: "apply" | "discard";
			}) => api.reviewPreview(param(contentId), messageId, decision),
			onSuccess: refreshContents,
		}),
	};
}
