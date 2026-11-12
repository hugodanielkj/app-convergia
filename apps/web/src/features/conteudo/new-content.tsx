import { useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext, useState } from "react";
import { errorMessage } from "../../api/client";
import { useContentMutations } from "./mutations";
import { NewContentSheet } from "./new-content-sheet";

type OpenNewContent = (plannedDate?: string | null) => void;

const NewContentContext = createContext<OpenNewContent>(() => {});

/** Abre o "Novo card" de qualquer tela da empresa: botão Criar, dia do calendário, Início. */
export function useOpenNewContent(): OpenNewContent {
	return useContext(NewContentContext);
}

export function NewContentProvider({
	companyId,
	children,
}: {
	companyId: string;
	children: ReactNode;
}) {
	const [state, setState] = useState<{
		open: boolean;
		plannedDate: string | null;
	}>({
		open: false,
		plannedDate: null,
	});
	const { create } = useContentMutations(companyId);
	const navigate = useNavigate();

	const open: OpenNewContent = (plannedDate = null) => {
		create.reset();
		setState({ open: true, plannedDate });
	};

	return (
		<NewContentContext.Provider value={open}>
			{children}
			<NewContentSheet
				open={state.open}
				plannedDate={state.plannedDate}
				busy={create.isPending}
				error={create.error ? errorMessage(create.error) : null}
				onClose={() => setState((s) => ({ ...s, open: false }))}
				onCreate={(input) =>
					create.mutate(input, {
						onSuccess: (content) => {
							setState((s) => ({ ...s, open: false }));
							void navigate({
								to: "/empresas/$companyId/cards/$contentId",
								params: { companyId, contentId: content.id },
							});
						},
					})
				}
			/>
		</NewContentContext.Provider>
	);
}
