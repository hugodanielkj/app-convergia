import {
	DomainError,
	type ReferenceEvidence,
	type ReferenceProvider,
} from "@convergia/core";
import { z } from "zod";
import { SCRAPECREATORS_BASE_URL } from "./scrapecreators-provider";

const caption = z
	.object({
		edges: z
			.array(z.object({ node: z.object({ text: z.string().max(150000) }) }))
			.max(100),
	})
	.nullish();
const count = z
	.object({ count: z.number().nonnegative().nullable() })
	.nullish();
const post = z.object({
	edge_media_to_caption: caption,
	edge_media_preview_like: count,
	edge_liked_by: count,
	edge_media_to_parent_comment: count,
	edge_media_to_comment: count,
	owner: z.object({ is_private: z.boolean().optional() }).optional(),
});
const profile = z.object({
	username: z.string(),
	full_name: z.string().nullish(),
	biography: z.string().max(150000).nullish(),
	is_private: z.boolean(),
	edge_owner_to_timeline_media: z
		.object({ edges: z.array(z.object({ node: post })).max(100) })
		.nullish(),
});
const evidencePost = (p: z.infer<typeof post>) => ({
	caption: (
		p.edge_media_to_caption?.edges.map((e) => e.node.text).join("\n") ?? ""
	).slice(0, 10000),
	likes: p.edge_media_preview_like?.count ?? p.edge_liked_by?.count ?? null,
	comments:
		p.edge_media_to_parent_comment?.count ??
		p.edge_media_to_comment?.count ??
		null,
});
/** RN-031/RN-035: só dados públicos. Respostas do fornecedor são validadas e limitadas. */
export function createReferenceProvider(
	apiKey: string | undefined,
	fetcher: typeof fetch = fetch,
): ReferenceProvider {
	return {
		configured: !!apiKey,
		async collect(target) {
			if (!apiKey) throw unavailable();
			const url = new URL(
				target.kind === "creator"
					? "/v1/instagram/profile"
					: "/v1/instagram/post",
				SCRAPECREATORS_BASE_URL,
			);
			if (target.kind === "creator")
				url.searchParams.set("handle", target.handle ?? "");
			else {
				url.searchParams.set("url", target.url);
				url.searchParams.set("get_play_count", "false");
			}
			let data: unknown;
			try {
				const response = await fetcher(url, {
					headers: { "x-api-key": apiKey },
					signal: AbortSignal.timeout(20000),
					redirect: "error",
				});
				if (!response.ok) throw unavailable();
				const raw = await response.text();
				if (raw.length > 2_000_000) throw unavailable();
				data = JSON.parse(raw);
			} catch {
				throw unavailable();
			}
			const envelope = z
				.object({ success: z.literal(true), data: z.unknown() })
				.parse(data);
			let evidence: ReferenceEvidence;
			if (target.kind === "creator") {
				const user = z.object({ user: profile }).parse(envelope.data).user;
				if (user.is_private)
					throw new DomainError(
						"private_reference",
						"Só é possível coletar referências públicas.",
					);
				evidence = {
					title: user.full_name || user.username,
					bio: user.biography?.slice(0, 10000) ?? null,
					posts: (user.edge_owner_to_timeline_media?.edges ?? [])
						.slice(0, 12)
						.map((e) => evidencePost(e.node)),
				};
			} else {
				const p = z
					.object({ xdt_shortcode_media: post })
					.parse(envelope.data).xdt_shortcode_media;
				if (p.owner?.is_private)
					throw new DomainError(
						"private_reference",
						"Só é possível coletar referências públicas.",
					);
				evidence = {
					title: "Post do Instagram",
					bio: null,
					posts: [evidencePost(p)],
				};
			}
			if (!evidence.bio && !evidence.posts.some((p) => p.caption))
				throw new DomainError(
					"reference_without_text",
					"A referência não tem texto público suficiente para análise.",
				);
			return evidence;
		},
	};
}
const unavailable = () =>
	new DomainError(
		"reference_provider_unavailable",
		"Não foi possível coletar a referência agora. Confira se ela é pública e tente novamente.",
	);
