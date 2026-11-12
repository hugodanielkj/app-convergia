import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getDevApiKey } from "../../lib/dev-session";
import { DevLogin } from "./dev-login";

describe("entrada de desenvolvimento", () => {
	it("guarda a chave só na aba e segue", async () => {
		const onDone = vi.fn();
		render(<DevLogin onDone={onDone} />);

		await userEvent.type(
			screen.getByLabelText(/Chave de desenvolvimento/),
			"  ag_mcp_teste  ",
		);
		await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

		expect(getDevApiKey()).toBe("ag_mcp_teste");
		expect(onDone).toHaveBeenCalledOnce();
	});
});
