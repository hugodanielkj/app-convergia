import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { contentsKey } from "../../api/queries";

/** Enviar, cancelar, aprovar e recusar. Toda decisão recarrega os cards e as listas. */
export function useApprovalMutations(companyId: string) {
	const queryClient = useQueryClient();
	const onSuccess = () =>
		queryClient.invalidateQueries({ queryKey: contentsKey(companyId) });
	const param = (contentId: string) => ({ companyId, contentId });

	return {
		submit: useMutation({
			mutationFn: (contentId: string) => api.submitApproval(param(contentId)),
			onSuccess,
		}),
		cancel: useMutation({
			mutationFn: (contentId: string) => api.cancelApproval(param(contentId)),
			onSuccess,
		}),
		approve: useMutation({
			mutationFn: ({
				contentId,
				version,
				onBehalfReason,
			}: {
				contentId: string;
				version: number;
				onBehalfReason?: string;
			}) =>
				api.approve(param(contentId), {
					version,
					...(onBehalfReason !== undefined && { onBehalfReason }),
				}),
			// Mesmo quando a versão mudou, o card precisa recarregar para mostrar a nova.
			onSettled: onSuccess,
		}),
		reject: useMutation({
			mutationFn: ({
				contentId,
				version,
				reason,
			}: {
				contentId: string;
				version: number;
				reason?: string;
			}) =>
				api.reject(param(contentId), {
					version,
					...(reason !== undefined && { reason }),
				}),
			onSettled: onSuccess,
		}),
	};
}
