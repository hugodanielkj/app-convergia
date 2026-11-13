import { ExternalLink } from "lucide-react";
import type { CitationDto } from "../../api/client";

/** Domínio para mostrar abaixo do título; `null` se o endereço não for um link da web. */
function webHost(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:"
			? parsed.hostname.replace(/^www\./, "")
			: null;
	} catch {
		return null;
	}
}

/** Páginas da web que embasam o roteiro (📎 RN-075). Abrem em outra aba. */
export function CitationList({ citations }: { citations: CitationDto[] }) {
	return (
		<ul className="flex flex-col">
			{citations.map((citation) => {
				const host = webHost(citation.url);
				const label = (
					<>
						<span className="line-clamp-2 font-medium">{citation.title}</span>
						{host && (
							<span className="text-xs text-zinc-500 dark:text-zinc-400">
								{host}
							</span>
						)}
					</>
				);
				return (
					<li key={citation.url}>
						{host ? (
							<a
								href={citation.url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex min-h-11 items-center justify-between gap-3 rounded-lg py-1.5 text-sm text-brand-800 hover:underline dark:text-brand-200"
							>
								<span className="flex flex-col">{label}</span>
								<ExternalLink className="size-4 shrink-0" aria-hidden />
							</a>
						) : (
							<span className="flex min-h-11 flex-col justify-center py-1.5 text-sm">
								{label}
							</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}
