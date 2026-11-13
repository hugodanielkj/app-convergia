/** Lê método, caminho e corpo JSON de uma chamada a `fetch` feita pelo cliente da API. */
export function fetchCall(input: RequestInfo | URL, init?: RequestInit) {
	// O cliente da API chama `fetch(url, init)`; `Request` nem sempre existe no jsdom.
	const url =
		typeof input === "object" && "url" in input ? input.url : String(input);
	return {
		method: (init?.method ?? "GET").toUpperCase(),
		url: new URL(url, "http://localhost").pathname,
		body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
	};
}
