import type { InstagramGateway, InstagramPost } from "@convergia/core";

const DAY = 86_400_000;

/** Legendas de exemplo: uma cafeteria fictícia, para testar o app sem a Meta. */
const SAMPLE_POSTS: Omit<InstagramPost, "id" | "publishedAt">[] = [
	{
		caption:
			"Bastidores da torra de hoje ☕ Você sabia que a torra média realça as notas de chocolate? Conta aqui qual é o seu café preferido!",
		mediaType: "video",
		permalink: null,
		likeCount: 412,
		commentsCount: 57,
	},
	{
		caption:
			"3 erros que deixam o seu café amargo (e como evitar cada um). Salve para lembrar na próxima passada!",
		mediaType: "carousel",
		permalink: null,
		likeCount: 368,
		commentsCount: 21,
	},
	{
		caption:
			"Promoção de sexta: na compra de 2 pacotes, o terceiro sai pela metade.",
		mediaType: "image",
		permalink: null,
		likeCount: 95,
		commentsCount: 8,
	},
	{
		caption:
			"Conheça a Dona Lúcia, produtora do nosso grão da Serra do Caparaó. Café especial começa no cuidado com a lavoura 🌱",
		mediaType: "video",
		permalink: null,
		likeCount: 287,
		commentsCount: 33,
	},
	{
		caption: "Horário de funcionamento no feriado: abrimos das 8h às 14h.",
		mediaType: "image",
		permalink: null,
		likeCount: 41,
		commentsCount: 2,
	},
];

/**
 * Instagram simulado, só fora de produção e sem o app da Meta: a "autorização" volta direto para
 * o app e os dados são de exemplo, marcados como simulados na conexão e na tela.
 */
export function createSimulatedInstagramGateway(): InstagramGateway {
	return {
		configured: true,
		simulated: true,

		authorizeUrl({ state, username }) {
			const params = new URLSearchParams({
				state,
				code: `simulado:${username}`,
			});
			return `/api/instagram/callback?${params.toString()}`;
		},

		async exchangeCode(code) {
			// O "código" leva o @ informado, e o token simulado também: assim o perfil confere.
			const username = code.replace(/^simulado:/, "") || "conta_simulada";
			return {
				igUserId: `simulado-${username}`,
				accessToken: `simulado:${username}`,
				expiresAt: new Date(Date.now() + 60 * DAY),
			};
		},

		async refreshToken(accessToken) {
			return { accessToken, expiresAt: new Date(Date.now() + 60 * DAY) };
		},

		async fetchSnapshot(accessToken, limit) {
			const username = accessToken.replace(/^simulado:/, "");
			const now = Date.now();
			return {
				profile: {
					username,
					name: "Café Exemplo (simulado)",
					biography:
						"Cafés especiais torrados toda semana em Viçosa-MG. Perfil simulado para testar o app sem a Meta.",
					website: null,
					accountType: "business",
					followersCount: 4_820,
					followsCount: 310,
					mediaCount: 186,
					profilePictureUrl: null,
				},
				posts: SAMPLE_POSTS.slice(0, limit).map((post, index) => ({
					...post,
					id: `simulado-${index + 1}`,
					publishedAt: new Date(now - (index * 3 + 1) * DAY),
				})),
			};
		},
	};
}
