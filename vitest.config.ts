import { defineConfig } from "vitest/config";

const integration = "**/*.int.test.ts";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					include: ["{apps,packages}/**/*.test.ts"],
					exclude: [integration, "**/node_modules/**"],
				},
			},
			{
				test: {
					name: "integration",
					include: [`{apps,packages}/${integration}`],
					exclude: ["**/node_modules/**"],
				},
			},
		],
	},
});
