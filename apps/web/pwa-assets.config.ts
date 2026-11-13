import {
	defineConfig,
	minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

/** Laranja Convergia: preenche a margem dos ícones recortados pelo sistema. */
const BRAND = "#E8491E";

// `pnpm --filter @convergia/web icons` gera os ícones a partir de public/logo.svg.
export default defineConfig({
	preset: {
		...minimal2023Preset,
		maskable: {
			...minimal2023Preset.maskable,
			resizeOptions: { background: BRAND },
		},
		apple: {
			...minimal2023Preset.apple,
			resizeOptions: { background: BRAND },
		},
	},
	images: ["public/logo.svg"],
});
