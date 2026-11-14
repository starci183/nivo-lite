import { Document, type DocumentInterface } from "@langchain/core/documents"
import type { EmbeddingsInterface } from "@langchain/core/embeddings"
import { VectorStore } from "@langchain/core/vectorstores"
import type { NearPassage, PassageSource } from "./retrieval.contracts"

/** What a document of the meaning leg carries: the passage as the store answered it, with how near it is. */
export type NearPassageMetadata = Omit<NearPassage, "content">

/** One passage as a document with its cosine similarity. */
export type ScoredPassage = [DocumentInterface<NearPassageMetadata>, number]

/**
 * LangChain's `VectorStore` over the app's OWN passage store, read-only: the meaning leg of a retrieval. It keeps no table and no
 * layout of its own (BE-AI-5): `similaritySearchVectorWithScore` asks the function the domain handed over, which is already scoped
 * to the caller's access lane and compares only vectors of the model in use, so a filter argument has nothing to widen and is not
 * read. The score is the cosine similarity (1 = the same direction). An empty query vector (the caller had none: see
 * `MeteredEmbeddings`) finds nothing. Writing is refused: the index job is the only writer of passages.
 */
export class PassageVectorStore extends VectorStore {
    /** No filter is read: the access lane is fixed in the function the domain handed over. */
    declare FilterType: object

    constructor(
        embeddings: EmbeddingsInterface,
        private readonly byVector: PassageSource["byVector"],
    ) {
        super(embeddings, {})
    }

    /** The kind of the store, as LangChain names stores. */
    _vectorstoreType(): string {
        return "nivo-passages"
    }

    /** Refused: this adapter reads; the index job writes the passages and their vectors. */
    addVectors(): Promise<void> {
        return Promise.reject(new Error("the passage store is read-only here: the index job writes passages"))
    }

    /** Refused: this adapter reads; the index job writes the passages and their vectors. */
    addDocuments(): Promise<void> {
        return Promise.reject(new Error("the passage store is read-only here: the index job writes passages"))
    }

    /**
     * The passages nearest to a query TEXT, typed as the store answers them: the query is embedded through this store's embeddings
     * (the caller's metered path) and an empty vector finds nothing. What a retriever of this app calls.
     */
    async near(query: string, k: number): Promise<ReadonlyArray<NearPassage>> {
        const vector = await this.embeddings.embedQuery(query)
        return vector.length === 0 ? [] : this.byVector(vector, k)
    }

    /** The passages nearest to a query vector inside the caller's lane, nearest first, each with its cosine similarity. */
    async similaritySearchVectorWithScore(
        query: Array<number>,
        k: number,
    ): Promise<Array<ScoredPassage>> {
        if (query.length === 0) return []
        const near = await this.byVector(query, k)
        return near.map(({ content, ...metadata }) => [
            new Document<NearPassageMetadata>({ id: metadata.id, pageContent: content, metadata }),
            metadata.similarity,
        ])
    }
}
