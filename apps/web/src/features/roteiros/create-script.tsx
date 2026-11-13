import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { api, type ContentDto, errorMessage } from "../../api/client";
import { contentsKey } from "../../api/queries";
import { cn } from "../../lib/cn";
import { MEDIA_TYPE_LABEL } from "../conteudo/labels";
import { ScriptPreview } from "./script-preview";

type MediaType = NonNullable<ContentDto["mediaType"]>;

const inputClass =
	"w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-950";

/**
 * Fluxo guiado "Criar roteiro" (✅ RN-006, design §13.2): tema → gerar → revisar. O roteiro
 * fica salvo num card novo, na coluna Ideia; o refino continua dentro do card.
 */
export function CreateScript({ companyId }: { companyId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const themeId = useId();
	const detailsId = useId();
	const [theme, setTheme] = useState("");
	const [details, setDetails] = useState("");
	const [mediaType, setMediaType] = useState<MediaType | null>(null);
	// O card já criado, para tentar a geração de novo sem duplicá-lo.
	const [cardId, setCardId] = useState<string | null>(null);

	const generate = useMutation({
		mutationFn: async () => {
			let id = cardId;
			if (!id) {
				const card = await api.createContent(companyId, {
					title: theme.trim(),
					idea: details.trim() || null,
					mediaType,
				});
				id = card.id;
				setCardId(id);
			}
			return api.generateScript({ companyId, contentId: id });
		},
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: contentsKey(companyId) }),
	});

	const restart = () => {
		generate.reset();
		setCardId(null);
		setTheme("");
		setDetails("");
		setMediaType(null);
	};
	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (theme.trim() && !generate.isPending) generate.mutate();
	};

	if (generate.isSuccess) {
		const content = generate.data;
		const openCard = (refine: boolean) =>
			void navigate({
				to: "/empresas/$companyId/cards/$contentId",
				params: { companyId, contentId: content.id },
				search: refine ? { refinar: true } : {},
			});
		return (
			<div className="flex flex-col gap-5 pb-40">
				<div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
					<Check className="mt-0.5 size-5 shrink-0" aria-hidden />
					<p>
						Roteiro pronto e salvo no card <strong>{content.title}</strong>, na
						coluna Ideia.
					</p>
				</div>
				<h1 className="text-3xl font-medium">Revise o roteiro</h1>
				<section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
					<ScriptPreview script={content.script} />
				</section>
				<StickyActions>
					<button
						type="button"
						onClick={() => openCard(true)}
						className="min-h-12 w-full rounded-xl bg-brand-600 font-semibold text-white"
					>
						Refinar com a IA
					</button>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={restart}
							className="min-h-12 flex-1 rounded-xl font-medium ring-1 ring-zinc-300 dark:ring-zinc-700"
						>
							Criar outro
						</button>
						<button
							type="button"
							onClick={() => openCard(false)}
							className="min-h-12 flex-1 rounded-xl font-medium ring-1 ring-zinc-300 dark:ring-zinc-700"
						>
							Abrir o card
						</button>
					</div>
				</StickyActions>
			</div>
		);
	}

	if (generate.isPending) {
		return (
			<div
				role="status"
				aria-live="polite"
				className="flex flex-col items-center gap-6 pt-12 text-center"
			>
				<Sparkles
					className="size-10 animate-pulse text-brand-600"
					aria-hidden
				/>
				<div>
					<p className="text-lg font-semibold">Escrevendo o roteiro...</p>
					<p className="text-zinc-600 dark:text-zinc-400">
						Leva alguns segundos. O resultado fica salvo no card.
					</p>
				</div>
				<div className="flex w-full flex-col gap-3" aria-hidden>
					{[12, 28, 10, 20].map((height) => (
						<div
							key={height}
							style={{ height: `${height * 4}px` }}
							className="w-full animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800"
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-5 pb-40">
			<div className="flex items-center gap-2">
				<Link
					to="/empresas/$companyId"
					params={{ companyId }}
					aria-label="Voltar para o início"
					className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
				>
					<ArrowLeft className="size-5" aria-hidden />
				</Link>
				<h1 className="text-3xl font-medium">Criar roteiro</h1>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor={themeId} className="font-medium">
					Sobre o que é o post?
				</label>
				<input
					id={themeId}
					value={theme}
					onChange={(event) => setTheme(event.target.value)}
					maxLength={200}
					required
					autoComplete="off"
					placeholder="Ex.: 3 jeitos de usar o sofá retrátil"
					className={cn(inputClass, "min-h-12")}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor={detailsId} className="font-medium">
					Detalhes ou texto de apoio{" "}
					<span className="font-normal text-zinc-500">(opcional)</span>
				</label>
				<textarea
					id={detailsId}
					value={details}
					onChange={(event) => setDetails(event.target.value)}
					rows={4}
					maxLength={5000}
					placeholder="Cole um texto, uma promoção ou o que não pode faltar"
					className={inputClass}
				/>
			</div>

			<fieldset className="flex flex-col gap-2">
				<legend className="mb-1.5 font-medium">
					Tipo de post{" "}
					<span className="font-normal text-zinc-500">(opcional)</span>
				</legend>
				<div className="flex flex-wrap gap-2">
					{Object.entries(MEDIA_TYPE_LABEL).map(([value, label]) => {
						const selected = mediaType === value;
						return (
							<button
								key={value}
								type="button"
								aria-pressed={selected}
								onClick={() =>
									setMediaType(selected ? null : (value as MediaType))
								}
								className={cn(
									"min-h-11 rounded-full px-4 font-medium ring-1",
									selected
										? "bg-brand-600 text-white ring-brand-600"
										: "ring-zinc-300 dark:ring-zinc-700",
								)}
							>
								{label}
							</button>
						);
					})}
				</div>
			</fieldset>

			<StickyActions>
				{generate.isError && (
					<p role="alert" className="text-sm text-red-700 dark:text-red-300">
						{errorMessage(generate.error)}
						{cardId && " O card foi criado; você pode tentar de novo."}
					</p>
				)}
				<button
					type="submit"
					disabled={!theme.trim()}
					className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"
				>
					<Sparkles className="size-5" aria-hidden />
					{generate.isError ? "Tentar de novo" : "Gerar roteiro"}
				</button>
			</StickyActions>
		</form>
	);
}

/** Ação principal fixa, ao alcance do polegar, acima da navegação (design §13.3). */
function StickyActions({ children }: { children: ReactNode }) {
	return (
		<div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-4 md:left-60">
			<div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
				{children}
			</div>
		</div>
	);
}
