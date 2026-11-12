import { Link } from "@tanstack/react-router";
import {
	CalendarDays,
	CircleCheckBig,
	House,
	type LucideIcon,
	Menu,
	Plus,
} from "lucide-react";
import { cn } from "../lib/cn";

type NavItem = {
	label: string;
	to:
		| "/empresas/$companyId"
		| "/empresas/$companyId/calendario"
		| "/empresas/$companyId/aprovacoes"
		| "/empresas/$companyId/mais";
	icon: LucideIcon;
	exact?: boolean;
};

const BEFORE_CREATE: NavItem[] = [
	{ label: "Início", to: "/empresas/$companyId", icon: House, exact: true },
	{
		label: "Calendário",
		to: "/empresas/$companyId/calendario",
		icon: CalendarDays,
	},
];

const AFTER_CREATE: NavItem[] = [
	{
		label: "Aprovações",
		to: "/empresas/$companyId/aprovacoes",
		icon: CircleCheckBig,
	},
	{ label: "Mais", to: "/empresas/$companyId/mais", icon: Menu },
];

function NavLink({
	item,
	companyId,
	variant,
}: {
	item: NavItem;
	companyId: string;
	variant: "bottom" | "side";
}) {
	const Icon = item.icon;
	return (
		<Link
			to={item.to}
			params={{ companyId }}
			activeOptions={{ exact: item.exact ?? false }}
			className={cn(
				"flex items-center",
				variant === "bottom"
					? "min-h-14 flex-1 flex-col justify-center gap-0.5 text-xs"
					: "min-h-11 gap-3 rounded-xl px-3 text-sm font-medium",
			)}
			// Cores separadas por estado: o Link junta as classes sem resolver conflitos.
			inactiveProps={{
				className:
					variant === "bottom"
						? "text-zinc-600 dark:text-zinc-400"
						: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
			}}
			activeProps={{
				className:
					variant === "bottom"
						? "font-semibold text-brand-700 dark:text-brand-300"
						: "bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-100",
			}}
		>
			<Icon className="size-6 shrink-0" aria-hidden />
			<span>{item.label}</span>
		</Link>
	);
}

function CreateButton({
	onCreate,
	variant,
}: {
	onCreate: () => void;
	variant: "bottom" | "side";
}) {
	return variant === "bottom" ? (
		<div className="flex flex-1 justify-center">
			<button
				type="button"
				onClick={onCreate}
				aria-label="Criar"
				className="-mt-5 flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 active:scale-95"
			>
				<Plus className="size-7" aria-hidden />
			</button>
		</div>
	) : (
		<button
			type="button"
			onClick={onCreate}
			className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
		>
			<Plus className="size-5" aria-hidden />
			Criar
		</button>
	);
}

/** Navegação fixa no rodapé do celular (design §13.1). */
export function BottomNav({
	companyId,
	onCreate,
}: {
	companyId: string;
	onCreate: () => void;
}) {
	return (
		<nav
			aria-label="Navegação principal"
			className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
		>
			<div className="mx-auto flex max-w-lg items-end">
				{BEFORE_CREATE.map((item) => (
					<NavLink
						key={item.to}
						item={item}
						companyId={companyId}
						variant="bottom"
					/>
				))}
				<CreateButton onCreate={onCreate} variant="bottom" />
				{AFTER_CREATE.map((item) => (
					<NavLink
						key={item.to}
						item={item}
						companyId={companyId}
						variant="bottom"
					/>
				))}
			</div>
		</nav>
	);
}

/** A mesma navegação como barra lateral, do tablet em diante (design §13.1). */
export function SideNav({
	companyId,
	onCreate,
}: {
	companyId: string;
	onCreate: () => void;
}) {
	return (
		<nav
			aria-label="Navegação principal"
			className="hidden w-60 shrink-0 flex-col gap-1 border-r border-zinc-200 p-4 md:flex dark:border-zinc-800"
		>
			<CreateButton onCreate={onCreate} variant="side" />
			<div className="mt-3 flex flex-col gap-1">
				{[...BEFORE_CREATE, ...AFTER_CREATE].map((item) => (
					<NavLink
						key={item.to}
						item={item}
						companyId={companyId}
						variant="side"
					/>
				))}
			</div>
		</nav>
	);
}
