import type { SearchPeriod, VideoPlatform } from "./video";

/**
 * Versão da estratégia de busca. Mudou a forma de coletar ou filtrar, sobe o número: o cache
 * antigo deixa de valer sem precisar ser apagado (✅ RN-114).
 */
export const STRATEGY_VERSION = 1;

/** Texto como a pessoa escreveu, só sem espaços sobrando. É o que vai para o provedor. */
export function cleanQuery(text: string): string {
	return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

function stripAccents(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Forma usada para comparar pesquisas: sem acento, minúscula e sem espaço sobrando. */
export function normalizeQuery(text: string): string {
	return stripAccents(cleanQuery(text)).toLowerCase();
}

/** Chave do cache: consulta normalizada, filtros e versão da estratégia (✅ RN-114). */
export function cacheKey(input: {
	query: string;
	platforms: VideoPlatform[];
	period: SearchPeriod;
}): string {
	const platforms = [...input.platforms].sort().join(",");
	return `v${STRATEGY_VERSION}|${input.period}|${platforms}|${normalizeQuery(input.query)}`;
}

const PT_WORDS = new Set([
	"como",
	"para",
	"com",
	"que",
	"nao",
	"uma",
	"um",
	"de",
	"do",
	"da",
	"dos",
	"das",
	"em",
	"no",
	"na",
	"fazer",
	"criar",
	"dicas",
	"videos",
	"video",
	"receita",
	"melhores",
	"voce",
]);

/**
 * ✅ RN-113: pesquisas em português priorizam vídeos em português. É só o idioma da pesquisa:
 * não diz nada sobre o país do vídeo.
 */
export function queryLanguage(text: string): "pt" | null {
	if (/[ãõçáéíóúâêôà]/i.test(text)) return "pt";
	const words = tokenize(text);
	const hits = words.filter((word) => PT_WORDS.has(word)).length;
	return hits > 0 && hits >= words.length / 4 ? "pt" : null;
}

const STOPWORDS = new Set([
	...[
		"a",
		"o",
		"as",
		"os",
		"e",
		"ou",
		"de",
		"do",
		"da",
		"dos",
		"das",
		"em",
		"no",
		"na",
		"nos",
		"nas",
		"um",
		"uma",
		"com",
		"sem",
		"para",
		"pra",
		"por",
		"como",
		"que",
		"se",
		"ao",
		"aos",
		"seu",
		"sua",
		"mais",
		"muito",
	],
	...[
		"the",
		"and",
		"or",
		"of",
		"to",
		"in",
		"on",
		"for",
		"with",
		"how",
		"what",
		"is",
		"are",
		"an",
		"my",
		"your",
	],
]);

/** Palavras sem acento e em minúsculas. Hashtags viram palavras (`#receita` → `receita`). */
export function tokenize(text: string): string[] {
	return stripAccents(text)
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

/** Palavras que carregam o assunto: sem artigos, preposições e afins. */
export function keywords(text: string): string[] {
	return [...new Set(tokenize(text).filter((word) => !STOPWORDS.has(word)))];
}

/** "ia" e "ai" são a mesma coisa. */
const SYNONYMS: Record<string, string[]> = {
	ia: ["ai"],
	ai: ["ia"],
};

/** Mesma raiz: "criar" e "criando", "video" e "videos", "inteligencia" e "#inteligenciaartificial". */
function sameRoot(a: string, b: string): boolean {
	if (a === b) return true;
	let common = 0;
	while (common < a.length && common < b.length && a[common] === b[common]) {
		common++;
	}
	return common >= 4 && common >= Math.min(a.length, b.length) - 2;
}

function wordMatches(keyword: string, words: string[]): boolean {
	const options = [keyword, ...(SYNONYMS[keyword] ?? [])];
	return words.some((word) => options.some((option) => sameRoot(word, option)));
}

/**
 * ✅ RN-115: quanto o texto disponível (legenda e hashtags) fala do assunto, de 0 a 1. Vale a
 * melhor entre as variações da pesquisa. Não é uma análise do vídeo em si.
 */
export function matchScore(text: string | null, terms: string[]): number {
	if (!text) return 0;
	const words = tokenize(text);
	let best = 0;
	for (const term of terms) {
		const wanted = keywords(term);
		if (wanted.length === 0) continue;
		const found = wanted.filter((keyword) =>
			wordMatches(keyword, words),
		).length;
		best = Math.max(best, found / wanted.length);
	}
	return best;
}
