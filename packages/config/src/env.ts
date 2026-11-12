import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
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
