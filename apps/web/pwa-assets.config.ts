import {
	defineConfig,
	minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

// `pnpm --filter @convergia/web icons` gera os ícones a partir de public/logo.svg.
export default defineConfig({
	preset: minimal2023Preset,
	images: ["public/logo.svg"],
});
