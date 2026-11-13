import {
	Eye,
	Heart,
	MessageCircle,
	Play,
	Share2,
	SquareArrowOutUpRight,
	TrendingUp,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { DiscoveredVideoDto } from "../../api/client";
import { cn } from "../../lib/cn";

export const PLATFORM_LABEL = {
	instagram: "Instagram",
	tiktok: "TikTok",
} as const;

const compact = new Intl.NumberFormat("pt-BR", {
	notation: "compact",
	maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("pt-BR");
const shortDate = new Intl.DateTimeFormat("pt-BR", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "America/Sao_Paulo",
});

/** Só vira link um endereço http(s); o resto aparece como texto. */
export function safeLink(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:"
			? parsed.toString()
			: null;
	} catch {
		return null;
	}
}

function Metric({
	icon: Icon,
	value,
	label,
}: {
	icon: typeof Eye;
	value: number | null;
	label: string;
}) {
	// ✅ RN-112: métrica que o provedor não trouxe não aparece; nunca vira zero.
	if (value === null) return null;
	return (
		<li
			className="flex items-center gap-1"
			title={`${full.format(value)} ${label}`}
		>
			<Icon className="size-4 text-zinc-500" aria-hidden />
			<span>{compact.format(value)}</span>
			<span className="sr-only">{label}</span>
		</li>
	);
}

function Thumbnail({ video }: { video: DiscoveredVideoDto }) {
	const [broken, setBroken] = useState(false);
	const src = video.thumbnailUrl ? safeLink(video.thumbnailUrl) : null;
	return (
		<div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-200 md:w-full dark:bg-zinc-800">
			{src && !broken ? (
				<img
					src={src}
					alt=""
					loading="lazy"
					referrerPolicy="no-referrer"
					onError={() => setBroken(true)}
					className="size-full object-cover"
				/>
			) : (
				<div className="flex size-full items-center justify-center">
					<Play className="size-8 text-zinc-400" aria-hidden />
				</div>
			)}
		</div>
	);
}

/** Um vídeo encontrado, com os dados disponíveis e o link original (✅ RN-119). */
export function VideoCard({ video }: { video: DiscoveredVideoDto }) {
	const link = safeLink(video.url);
	const platform = PLATFORM_LABEL[video.platform];
	const published = video.publishedAt
		? shortDate.format(new Date(video.publishedAt))
		: null;
	const metrics: ReactNode[] = [
		<Metric
			key="v"
			icon={Eye}
			value={video.metrics.views}
			label="visualizações"
		/>,
		<Metric
			key="l"
			icon={Heart}
			value={video.metrics.likes}
			label="curtidas"
		/>,
		<Metric
			key="c"
			icon={MessageCircle}
			value={video.metrics.comments}
			label="comentários"
		/>,
		<Metric
			key="s"
			icon={Share2}
			value={video.metrics.shares}
			label="compartilhamentos"
		/>,
	];
	const hasMetric = Object.values(video.metrics).some(
		(value) => value !== null,
	);

	return (
		<article className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200 md:flex-col dark:bg-zinc-900 dark:ring-zinc-800">
			<Thumbnail video={video} />
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="flex flex-wrap items-center gap-1.5 text-xs">
					<span
						className={cn(
							"rounded-full px-2 py-0.5 font-semibold",
							video.platform === "tiktok"
								? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
								: "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-100",
						)}
					>
						{platform}
					</span>
					{video.growing && (
						<span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
							<TrendingUp className="size-3.5" aria-hidden />
							Em crescimento
						</span>
					)}
				</div>
				<p className="truncate text-sm font-medium">
					{video.creatorHandle
						? `@${video.creatorHandle}`
						: "Criador não informado"}
					{published && (
						<span className="font-normal text-zinc-500"> · {published}</span>
					)}
				</p>
				<p className="line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">
					{video.caption ?? "Sem legenda."}
				</p>
				{hasMetric ? (
					<ul
						aria-label="Métricas públicas"
						className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
					>
						{metrics}
					</ul>
				) : (
					<p className="text-sm text-zinc-500">Sem métricas disponíveis.</p>
				)}
				{link ? (
					<a
						href={link}
						target="_blank"
						rel="noopener noreferrer"
						className="mt-auto flex min-h-11 items-center gap-2 font-semibold text-brand-700 dark:text-brand-300"
					>
						<SquareArrowOutUpRight className="size-4" aria-hidden />
						Assistir no {platform}
					</a>
				) : (
					<p className="mt-auto text-sm text-zinc-500">Link indisponível.</p>
				)}
			</div>
		</article>
	);
}
