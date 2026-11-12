import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const THEME_COLOR = "#4f3bd9";

export default defineConfig({
	plugins: [
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		tailwindcss(),
		// RN-005: instalável na tela inicial. O service worker guarda só a casca do app;
		// os dados vêm sempre da API (stack.md §2.1).
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png"],
			manifest: {
				name: "ConvergIA",
				short_name: "ConvergIA",
				description:
					"Planeje e produza o conteúdo do Instagram da sua empresa, com a sua agência.",
				lang: "pt-BR",
				start_url: "/",
				scope: "/",
				display: "standalone",
				orientation: "portrait",
				theme_color: THEME_COLOR,
				background_color: "#ffffff",
				icons: [
					{ src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
					{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
					{ src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
					{
						src: "maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
				navigateFallback: "/index.html",
				navigateFallbackDenylist: [/^\/api\//],
			},
		}),
	],
	server: {
		// App e API no mesmo domínio, como em produção (stack.md §2.1).
		proxy: { "/api": "http://localhost:3000" },
	},
});
