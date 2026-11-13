import { z } from "zod";

/** Variável opcional: vazia no `.env` conta como ausente. */
const optionalText = z
	.string()
	.optional()
	.transform((value) => (value === "" ? undefined : value));

/** Número opcional: vazio no `.env` usa o padrão. */
const numberOr = (fallback: number, min: number, max: number) =>
	z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.coerce.number().int().min(min).max(max).default(fallback),
	);

const flagOr = (fallback: boolean) =>
	z
		.enum(["true", "false", ""])
		.optional()
		.transform((value) => (value ? value === "true" : fallback));

const envSchema = z
	.object({
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		PORT: z.coerce.number().int().min(1).max(65535).default(3000),
		DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
		// Chave da API da Anthropic (stack §4). Obrigatória em produção.
		ANTHROPIC_API_KEY: optionalText,
		// Gemini gratuito, só para testar fora de produção sem gastar créditos.
		GEMINI_API_KEY: optionalText,
		GEMINI_MODEL: optionalText,
		// Descoberta de vídeos (RN-110 a RN-119). Sem a chave, a tela avisa que falta configurar.
		SCRAPECREATORS_API_KEY: optionalText,
		VIDEO_SEARCH_CACHE_TTL_HOURS: numberOr(6, 1, 168),
		VIDEO_SEARCH_DAILY_LIMIT_PER_USER: numberOr(20, 1, 1_000),
		VIDEO_SEARCH_PER_MINUTE_LIMIT: numberOr(5, 1, 60),
		VIDEO_SEARCH_MAX_CALLS: numberOr(8, 1, 50),
		VIDEO_SEARCH_METRIC_REFRESH: numberOr(5, 0, 40),
		VIDEO_SEARCH_TIMEOUT_MS: numberOr(20_000, 1_000, 120_000),
		VIDEO_SEARCH_AI_EXPANSION: flagOr(true),
		// App da Meta com o login do Instagram (RN-035). Sem ele, fora de produção, o Instagram é simulado.
		INSTAGRAM_APP_ID: optionalText,
		INSTAGRAM_APP_SECRET: optionalText,
		INSTAGRAM_REDIRECT_URI: optionalText.pipe(z.url().optional()),
		// Chave de 32 bytes em base64 que criptografa os tokens do Instagram no banco.
		INSTAGRAM_TOKEN_KEY: optionalText.pipe(
			z
				.string()
				.refine((value) => Buffer.from(value, "base64").length === 32, {
					message: "precisa ter 32 bytes em base64",
				})
				.optional(),
		),
	})
	.refine((env) => env.NODE_ENV !== "production" || env.ANTHROPIC_API_KEY, {
		path: ["ANTHROPIC_API_KEY"],
		message: "obrigatória em produção",
	})
	.superRefine((env, ctx) => {
		// Com o app da Meta, as outras três passam a ser obrigatórias.
		if (!env.INSTAGRAM_APP_ID) return;
		for (const name of [
			"INSTAGRAM_APP_SECRET",
			"INSTAGRAM_REDIRECT_URI",
			"INSTAGRAM_TOKEN_KEY",
		] as const) {
			if (!env[name]) {
				ctx.addIssue({
					code: "custom",
					path: [name],
					message: "obrigatória com INSTAGRAM_APP_ID",
				});
			}
		}
	});

export type Env = z.infer<typeof envSchema>;

/**
 * Único ponto de leitura das variáveis de ambiente.
 * A mensagem de erro lista só os nomes das variáveis, nunca os valores.
 */
export function loadEnv(
	source: Record<string, string | undefined> = process.env,
): Env {
	const result = envSchema.safeParse(source);
	if (!result.success) {
		const names = [
			...new Set(result.error.issues.map((issue) => issue.path.join("."))),
		];
		throw new Error(
			`Variáveis de ambiente inválidas ou ausentes: ${names.join(", ")}. Veja .env.example.`,
		);
	}
	return result.data;
}
