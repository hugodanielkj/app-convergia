import { defineConfig } from "vitest/config";

const integration = "**/*.int.test.ts";

export default defineConfig({
	test: {
		projects: [
			"apps/web/vitest.config.ts",
			{
				test: {
					name: "unit",
					include: ["{apps,packages}/**/*.test.ts"],
					exclude: [integration, "apps/web/**", "**/node_modules/**"],
				},
			},
			{
				test: {
					name: "integration",
					include: [`{apps,packages}/${integration}`],
					globalSetup: ["packages/infra/src/db/test-global-setup.ts"],
					exclude: ["**/node_modules/**"],
				},
			},
		],
	},
});
