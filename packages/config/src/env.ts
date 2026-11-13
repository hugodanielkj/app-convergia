import { z } from "zod";

/** Variável opcional: vazia no `.env` conta como ausente. */
const optionalText = z
	.string()
	.optional()
	.transform((value) => (value === "" ? undefined : value));

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
