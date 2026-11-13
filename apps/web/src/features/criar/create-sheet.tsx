import {
	Bookmark,
	FileText,
	Images,
	Lightbulb,
	type LucideIcon,
	SquarePlus,
} from "lucide-react";
import { BottomSheet } from "../../components/bottom-sheet";
import { SoonBadge } from "../../components/soon-badge";

type CreateOption = {
	label: string;
	description: string;
	icon: LucideIcon;
	action?: "new-content" | "create-script" | "ideas";
};

/** Menu do botão central "Criar" (design §13.2). As ações chegam com cada módulo (§12). */
export const CREATE_OPTIONS: CreateOption[] = [
	{
		label: "Criar roteiro",
		description: "A IA escreve a partir de um tema ou de um texto",
		icon: FileText,
		action: "create-script",
	},
	{
		label: "Novo card",
		description: "Uma ideia de post no calendário",
		icon: SquarePlus,
		action: "new-content",
	},
	{
		label: "Gerar ideias",
		action: "ideas",
		description: "Sugestões para a próxima semana",
		icon: Lightbulb,
	},
	{
		label: "Criar carrossel",
		description: "Lâminas prontas para o Instagram",
		icon: Images,
	},
	{
		label: "Salvar referência",
		description: "Um post ou perfil que inspira",
		icon: Bookmark,
	},
];

export function CreateSheet({
	open,
	onClose,
	onNewContent,
	onCreateScript,
	onIdeas,
}: {
	open: boolean;
	onClose: () => void;
	onNewContent: () => void;
	onCreateScript: () => void;
	onIdeas?: () => void;
}) {
	return (
		<BottomSheet open={open} title="Criar" onClose={onClose}>
			<ul className="flex flex-col">
				{CREATE_OPTIONS.map(({ label, description, icon: Icon, action }) => (
					<li key={label}>
						<button
							type="button"
							disabled={!action}
							onClick={() => {
								onClose();
								if (action === "ideas") onIdeas?.();
								else if (action === "create-script") onCreateScript();
								else onNewContent();
							}}
							className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-2 py-3 text-left hover:bg-zinc-100 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:hover:bg-zinc-800"
						>
							<span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-100">
								<Icon className="size-5" aria-hidden />
							</span>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="font-medium">{label}</span>
								<span className="text-sm text-zinc-600 dark:text-zinc-400">
									{description}
								</span>
							</span>
							{!action && <SoonBadge />}
						</button>
					</li>
				))}
			</ul>
		</BottomSheet>
	);
}
