import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
	NewContentProvider,
	useOpenNewContent,
} from "../features/conteudo/new-content";
import { CreateSheet } from "../features/criar/create-sheet";
import { BottomNav, SideNav } from "./app-nav";
import { BrandMark } from "./brand-logo";

/** Estrutura das telas dentro de uma empresa (design §13.1). */
export function AppShell({
	companyId,
	companyName,
	canSwitchCompany,
	children,
}: {
	companyId: string;
	companyName: string;
	canSwitchCompany: boolean;
	children: ReactNode;
}) {
	return (
		<NewContentProvider companyId={companyId}>
			<Shell
				companyId={companyId}
				companyName={companyName}
				canSwitchCompany={canSwitchCompany}
			>
				{children}
			</Shell>
		</NewContentProvider>
	);
}

function Shell({
	companyId,
	companyName,
	canSwitchCompany,
	children,
}: {
	companyId: string;
	companyName: string;
	canSwitchCompany: boolean;
	children: ReactNode;
}) {
	const [creating, setCreating] = useState(false);
	const openCreate = () => setCreating(true);
	const openNewContent = useOpenNewContent();
	const navigate = useNavigate();

	return (
		<div className="flex min-h-dvh">
			<SideNav companyId={companyId} onCreate={openCreate} />
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
					<div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
						<BrandMark className="size-7 shrink-0 md:hidden" />
						<p className="min-w-0 flex-1 truncate text-base font-semibold">
							{companyName}
						</p>
						{canSwitchCompany && (
							<Link
								to="/empresas"
								className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900"
							>
								<ArrowLeftRight className="size-4" aria-hidden />
								Trocar empresa
							</Link>
						)}
					</div>
				</header>
				<main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
					{children}
				</main>
			</div>
			<BottomNav companyId={companyId} onCreate={openCreate} />
			<CreateSheet
				open={creating}
				onClose={() => setCreating(false)}
				onNewContent={() => openNewContent()}
				onCreateScript={() =>
					void navigate({
						to: "/empresas/$companyId/roteiros/novo",
						params: { companyId },
					})
				}
			/>
		</div>
	);
}
