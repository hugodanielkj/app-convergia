import { referenceTarget } from "@convergia/core";
import { describe, expect, it, vi } from "vitest";
import { createReferenceProvider } from "./reference-provider";

const caption = { edges: [{ node: { text: "Dica pública de decoração" } }] };
describe("Adaptador de referências ScrapeCreators", () => {
	it("coleta só campos públicos e preserva métricas ausentes como nulas", async () => {
		const fetcher = vi.fn<typeof fetch>(async () =>
			Response.json({
				success: true,
				data: {
					user: {
						username: "criador",
						full_name: "Exemplo",
						biography: "Decoração",
						is_private: false,
						business_email: "nao-guardar@example.test",
						edge_owner_to_timeline_media: {
							edges: [{ node: { edge_media_to_caption: caption } }],
						},
					},
				},
			}),
		);
		const p = createReferenceProvider("chave-ficticia", fetcher);
		const result = await p.collect(
			referenceTarget("https://instagram.com/criador/"),
		);
		expect(result.posts[0]).toMatchObject({
			caption: "Dica pública de decoração",
			likes: null,
			comments: null,
		});
		expect(JSON.stringify(result)).not.toContain("business_email");
		expect(String(fetcher.mock.calls[0]?.[0])).toContain("handle=criador");
	});
	it("não coleta conteúdo de perfil privado", async () => {
		const fetcher = vi.fn<typeof fetch>(async () =>
			Response.json({
				success: true,
				data: { user: { username: "privado", is_private: true } },
			}),
		);
		await expect(
			createReferenceProvider("chave-ficticia", fetcher).collect(
				referenceTarget("https://instagram.com/privado/"),
			),
		).rejects.toThrow("públicas");
	});
	it("não interpreta HTTP 200 com success false como dado válido", async () => {
		const fetcher = vi.fn<typeof fetch>(async () =>
			Response.json({ success: false, message: "Bloqueado" }),
		);
		await expect(
			createReferenceProvider("chave-ficticia", fetcher).collect(
				referenceTarget("https://instagram.com/p/abc/"),
			),
		).rejects.toThrow();
	});
	it("coleta legenda do post e não baixa vídeo ou imagem", async () => {
		const fetcher = vi.fn<typeof fetch>(async () =>
			Response.json({
				success: true,
				data: {
					xdt_shortcode_media: {
						edge_media_to_caption: caption,
						video_url: "https://example.com/video.mp4",
					},
				},
			}),
		);
		const result = await createReferenceProvider(
			"chave-ficticia",
			fetcher,
		).collect(referenceTarget("https://instagram.com/reel/abc/"));
		expect(result.posts).toHaveLength(1);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(result)).not.toContain("video.mp4");
	});
	it("sem integração não faz requisição", async () => {
		const fetcher = vi.fn();
		await expect(
			createReferenceProvider(undefined, fetcher).collect(
				referenceTarget("https://instagram.com/criador/"),
			),
		).rejects.toThrow();
		expect(fetcher).not.toHaveBeenCalled();
	});
});
