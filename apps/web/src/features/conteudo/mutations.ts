import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ContentChanges, type ContentDto } from "../../api/client";
import { contentsKey } from "../../api/queries";

/** Ações sobre um card. Toda mudança recarrega as listas da empresa (kanban, calendário, lixeira). */
export function useContentMutations(companyId: string) {
	const queryClient = useQueryClient();
	const onSuccess = () =>
		queryClient.invalidateQueries({ queryKey: contentsKey(companyId) });
	const param = (contentId: string) => ({ companyId, contentId });

	return {
		create: useMutation({
			mutationFn: (input: { title: string; plannedDate: string | null }) =>
				api.createContent(companyId, input),
			onSuccess,
		}),
		update: useMutation({
			mutationFn: ({ id, changes }: { id: string; changes: ContentChanges }) =>
				api.updateContent(param(id), changes),
			onSuccess,
		}),
		move: useMutation({
			mutationFn: ({
				id,
				status,
			}: {
				id: string;
				status: ContentDto["status"];
			}) => api.moveContent(param(id), status),
			onSuccess,
		}),
		schedule: useMutation({
			mutationFn: ({
				id,
				plannedDate,
			}: {
				id: string;
				plannedDate: string | null;
			}) => api.scheduleContent(param(id), plannedDate),
			onSuccess,
		}),
		duplicate: useMutation({
			mutationFn: (id: string) => api.duplicateContent(param(id)),
			onSuccess,
		}),
		remove: useMutation({
			mutationFn: (id: string) => api.deleteContent(param(id)),
			onSuccess: (_, id) => {
				// O card foi para a lixeira: descarta a tela dele em vez de buscá-lo de novo.
				queryClient.removeQueries({
					queryKey: [...contentsKey(companyId), "one", id],
				});
				return onSuccess();
			},
		}),
		restore: useMutation({
			mutationFn: (id: string) => api.restoreContent(param(id)),
			onSuccess,
		}),
	};
}
