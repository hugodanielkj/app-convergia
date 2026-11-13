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
	})
	.refine((env) => env.NODE_ENV !== "production" || env.ANTHROPIC_API_KEY, {
		path: ["ANTHROPIC_API_KEY"],
		message: "obrigatória em produção",
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
