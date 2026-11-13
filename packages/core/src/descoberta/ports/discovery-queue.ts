/** Fila de coletas em segundo plano (design §8.3). Uma coleta por pesquisa de cada vez. */
export interface DiscoveryQueue {
	enqueue(queryId: string): Promise<void>;
}
