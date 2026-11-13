import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRightLeft,
	Copy,
	Ellipsis,
	History,
	Sparkles,
	Trash2,
} from "lucide-react";
import {
	cloneElement,
	type ReactElement,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";
import {
	type ContentDto,
	errorMessage,
	type ScriptField,
} from "../../api/client";
import { BottomSheet } from "../../components/bottom-sheet";
import { HistorySheet } from "../roteiros/history-sheet";
import { ScriptAiActions } from "../roteiros/script-ai-actions";
import {
	SCRIPT_FIELD_LABEL,
	ScriptOptionsSheet,
} from "../roteiros/script-options-sheet";
import { type ContentForm, diffForm, toForm } from "./content-form";
import {
	APPROVAL_BADGE,
	FUNNEL_STAGE_LABEL,
	MEDIA_TYPE_LABEL,
	STATUS_LABEL,
} from "./labels";
import { MoveSheet } from "./move-sheet";
import { useContentMutations } from "./mutations";

const inputClass =
	"min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950";

function Field({
	label,
	hint,
	action,
	children,
}: {
	label: string;
	hint?: string;
	action?: ReactNode;
	children: ReactElement<{ id?: string }>;
}) {
	const id = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex min-h-6 items-center justify-between gap-2">
				<label htmlFor={id} className="text-sm font-medium">
					{label}
				</label>
				{action}
			</div>
			{cloneElement(children, { id })}
			{hint && <span className="text-xs text-zinc-500">{hint}</span>}
		</div>
	);
}

/** Tela do card (design §13.2): conteúdo, roteiro, data e coluna. */
export function ContentEditor({
	content,
	startRefining = false,
}: {
	content: ContentDto;
	startRefining?: boolean;
}) {
	const companyId = content.companyId;
	const mutations = useContentMutations(companyId);
	const navigate = useNavigate();
	const [saved, setSaved] = useState(() => toForm(content));
	const [form, setForm] = useState(saved);
	const [moving, setMoving] = useState(false);
	const [actions, setActions] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [optionsFor, setOptionsFor] = useState<ScriptField | null>(null);
	const [showHistory, setShowHistory] = useState(false);

	useEffect(() => {
		const next = toForm(content);
		setSaved(next);
		setForm(next);
	}, [content]);

	const changes = diffForm(saved, form);
	const dirty = Object.keys(changes).length > 0;
	const set =
		(key: keyof ContentForm) => (event: { target: { value: string } }) =>
			setForm((f) => ({ ...f, [key]: event.target.value }));
	// 📎 RN-071: opções avulsas de cada parte; a IA lê o card salvo, por isso pede salvar antes.
	const optionsButton = (field: ScriptField) => (
		<button
			type="button"
			disabled={dirty}
			onClick={() => setOptionsFor(field)}
			aria-label={`Sugerir opções de ${SCRIPT_FIELD_LABEL[field].name}`}
			className="-my-2 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-200 dark:hover:bg-brand-900"
		>
			<Sparkles className="size-4" aria-hidden />
			Opções
		</button>
	);
	const approval = APPROVAL_BADGE[content.approvalStatus];
	const actionError =
		mutations.duplicate.error ??
		mutations.remove.error ??
		mutations.schedule.error;

	return (
		<div className="flex flex-col gap-5 pb-24">
			<div className="flex items-center gap-2">
				<Link
					to="/empresas/$companyId/calendario"
					params={{ companyId }}
					search={{ view: "kanban" }}
					className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
					aria-label="Voltar para o kanban"
				>
					<ArrowLeft className="size-5" aria-hidden />
				</Link>
				<div className="flex flex-1 flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => {
							mutations.move.reset();
							setMoving(true);
						}}
						className="flex min-h-9 items-center gap-1.5 rounded-full bg-zinc-200/70 px-3 text-sm font-medium dark:bg-zinc-800"
					>
						<ArrowRightLeft className="size-4" aria-hidden />
						{STATUS_LABEL[content.status]}
					</button>
					{approval && (
						<span
							className={`rounded-full px-3 py-1 text-sm font-medium ${approval.className}`}
						>
							{approval.label}
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={() => setActions(true)}
					aria-label="Mais ações"
					className="flex size-11 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
				>
					<Ellipsis className="size-5" aria-hidden />
				</button>
			</div>

			{actionError && (
				<p
					role="alert"
					className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
				>
					{errorMessage(actionError)}
				</p>
			)}

			<Field label="Título">
				<input
					value={form.title}
					onChange={set("title")}
					maxLength={200}
					className={`${inputClass} text-lg font-semibold`}
				/>
			</Field>

			<Field
				label="Data planejada"
				hint="Só organiza o calendário; nada é publicado no Instagram."
			>
				<input
					type="date"
					value={content.plannedDate ?? ""}
					onChange={(event) =>
						mutations.schedule.mutate({
							id: content.id,
							plannedDate: event.target.value || null,
						})
					}
					className={inputClass}
				/>
			</Field>

			<Field label="Ideia">
				<textarea
					value={form.idea}
					onChange={set("idea")}
					rows={3}
					maxLength={5000}
					className={inputClass}
				/>
			</Field>

			<section className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
				<div>
					<div className="flex items-center justify-between gap-2">
						<h2 className="text-lg font-semibold">Roteiro</h2>
						<button
							type="button"
							onClick={() => setShowHistory(true)}
							className="-my-2 flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
						>
							<History className="size-4" aria-hidden />
							Histórico
						</button>
					</div>
					{content.approvalStatus !== "none" && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Mudanças da agência no roteiro precisam da aprovação do cliente.
						</p>
					)}
				</div>
				<ScriptAiActions
					content={content}
					unsavedChanges={dirty}
					startRefining={startRefining}
				/>
				<Field label="Gancho" action={optionsButton("hook")}>
					<textarea
						value={form.hook}
						onChange={set("hook")}
						rows={2}
						maxLength={2000}
						className={inputClass}
					/>
				</Field>
				<Field label="Corpo" action={optionsButton("body")}>
					<textarea
						value={form.body}
						onChange={set("body")}
						rows={6}
						maxLength={20000}
						className={inputClass}
					/>
				</Field>
				<Field label="Chamada para ação (CTA)" action={optionsButton("cta")}>
					<textarea
						value={form.cta}
						onChange={set("cta")}
						rows={2}
						maxLength={2000}
						className={inputClass}
					/>
				</Field>
				<Field label="Legenda" action={optionsButton("caption")}>
					<textarea
						value={form.caption}
						onChange={set("caption")}
						rows={4}
						maxLength={5000}
						className={inputClass}
					/>
				</Field>
			</section>

			<section className="grid gap-4 sm:grid-cols-2">
				<Field label="Tipo de mídia">
					<select
						value={form.mediaType}
						onChange={set("mediaType")}
						className={inputClass}
					>
						<option value="">Não definido</option>
						{Object.entries(MEDIA_TYPE_LABEL).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</Field>
				<Field label="Etapa do funil">
					<select
						value={form.funnelStage}
						onChange={set("funnelStage")}
						className={inputClass}
					>
						<option value="">Não definida</option>
						{Object.entries(FUNNEL_STAGE_LABEL).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</Field>
				<Field label="Formato">
					<input
						value={form.format}
						onChange={set("format")}
						maxLength={100}
						placeholder="Ex.: tutorial"
						className={inputClass}
					/>
				</Field>
				<Field label="Categoria">
					<input
						value={form.category}
						onChange={set("category")}
						maxLength={100}
						placeholder="Ex.: produto"
						className={inputClass}
					/>
				</Field>
				<Field label="Duração alvo (segundos)">
					<input
						value={form.targetDurationSeconds}
						onChange={set("targetDurationSeconds")}
						inputMode="numeric"
						pattern="[0-9]*"
						className={inputClass}
					/>
				</Field>
			</section>

			{(dirty || mutations.update.isError) && (
				<div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-4 md:left-60">
					<div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
						{mutations.update.error && (
							<p
								role="alert"
								className="text-sm text-red-700 dark:text-red-300"
							>
								{errorMessage(mutations.update.error)}
							</p>
						)}
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => {
									mutations.update.reset();
									setForm(saved);
								}}
								className="min-h-12 flex-1 rounded-xl font-medium ring-1 ring-zinc-300 dark:ring-zinc-700"
							>
								Descartar
							</button>
							<button
								type="button"
								disabled={
									!dirty ||
									mutations.update.isPending ||
									form.title.trim() === ""
								}
								onClick={() =>
									mutations.update.mutate({ id: content.id, changes })
								}
								className="min-h-12 flex-[2] rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"
							>
								{mutations.update.isPending ? "Salvando..." : "Salvar"}
							</button>
						</div>
					</div>
				</div>
			)}

			<HistorySheet
				companyId={companyId}
				contentId={content.id}
				open={showHistory}
				onClose={() => setShowHistory(false)}
			/>

			<ScriptOptionsSheet
				key={optionsFor ?? "fechado"}
				companyId={companyId}
				contentId={content.id}
				field={optionsFor}
				onClose={() => setOptionsFor(null)}
				onUse={(field, text) => setForm((f) => ({ ...f, [field]: text }))}
			/>

			<MoveSheet
				content={moving ? content : null}
				busy={mutations.move.isPending}
				error={mutations.move.error ? errorMessage(mutations.move.error) : null}
				onClose={() => setMoving(false)}
				onMove={(status) =>
					mutations.move.mutate(
						{ id: content.id, status },
						{ onSuccess: () => setMoving(false) },
					)
				}
			/>

			<BottomSheet
				open={actions}
				title={confirmDelete ? "Excluir card?" : "Ações"}
				onClose={() => {
					setActions(false);
					setConfirmDelete(false);
				}}
			>
				{confirmDelete ? (
					<div className="flex flex-col gap-3">
						<p className="text-zinc-700 dark:text-zinc-300">
							O card vai para a lixeira e pode ser restaurado por 30 dias.
						</p>
						<button
							type="button"
							disabled={mutations.remove.isPending}
							onClick={() =>
								mutations.remove.mutate(content.id, {
									onSettled: () => setActions(false),
									onSuccess: () =>
										void navigate({
											to: "/empresas/$companyId/calendario",
											params: { companyId },
											search: { view: "kanban" },
										}),
								})
							}
							className="min-h-12 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-60"
						>
							Excluir
						</button>
					</div>
				) : (
					<ul className="flex flex-col">
						<li>
							<button
								type="button"
								disabled={mutations.duplicate.isPending}
								onClick={() =>
									mutations.duplicate.mutate(content.id, {
										onSettled: () => setActions(false),
										onSuccess: (copy) =>
											void navigate({
												to: "/empresas/$companyId/cards/$contentId",
												params: { companyId, contentId: copy.id },
											}),
									})
								}
								className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 hover:bg-zinc-100 dark:hover:bg-zinc-800"
							>
								<Copy className="size-5" aria-hidden />
								Duplicar
							</button>
						</li>
						<li>
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
							>
								<Trash2 className="size-5" aria-hidden />
								Excluir
							</button>
						</li>
					</ul>
				)}
			</BottomSheet>
		</div>
	);
}
