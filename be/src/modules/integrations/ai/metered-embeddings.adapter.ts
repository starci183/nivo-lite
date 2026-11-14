import { Embeddings } from "@langchain/core/embeddings"
import type { EmbedTexts } from "./retrieval.contracts"

/**
 * LangChain's `Embeddings` over the caller's own metered embedding path (`EmbedTexts`): the one way a retriever or a vector store of
 * this app turns a query into a vector. It builds no client and calls no provider: the function the domain hands over checks the
 * credits, calls the gateway and books the call, so a LangChain component can never embed outside the meter.
 *
 * When the caller has no vector to give (no key, no credits, a failed call) a text gets the EMPTY vector: LangChain's interface has
 * no "none", and an empty vector is what `PassageVectorStore` reads as "no meaning search", so a search degrades to words instead
 * of failing. It never retries: the caller's path owns the tries.
 */
export class MeteredEmbeddings extends Embeddings {
    constructor(private readonly embed: EmbedTexts) {
        super({ maxRetries: 0 })
    }

    /** One vector per text, in order; every one empty when the caller has none. */
    async embedDocuments(documents: Array<string>): Promise<Array<Array<number>>> {
        if (documents.length === 0) return []
        const vectors = await this.embed(documents)
        if (vectors?.length !== documents.length) return documents.map(() => [])
        return vectors.map((vector) => [...vector])
    }

    /** The vector of one query; empty when the caller has none. */
    async embedQuery(document: string): Promise<Array<number>> {
        const [vector] = await this.embedDocuments([document])
        return vector ?? []
    }
}
