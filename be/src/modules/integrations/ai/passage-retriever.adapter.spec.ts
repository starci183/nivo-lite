import { Document } from "@langchain/core/documents"
import { Embeddings } from "@langchain/core/embeddings"
import { BaseRetriever } from "@langchain/core/retrievers"
import { VectorStore } from "@langchain/core/vectorstores"
import { Test } from "@nestjs/testing"
import { MeteredEmbeddings } from "./metered-embeddings.adapter"
import { PassageRetriever } from "./passage-retriever.adapter"
import { PassageVectorStore } from "./passage-vector-store.adapter"
import { FUSION_K } from "./rank-fusion.policy"
import type { EmbedTexts, NearPassage, PassageSource, RetrievedPassage } from "./retrieval.contracts"
import { DELIVERY_TITLE_VI, OPENING_HOURS_QUERY_VI, SHIPPING_FEE_QUERY_VI } from "@tests/fixtures/i18n/ai-spec.messages"

const SUBJECT = Symbol("passage-retriever.adapter")

const passage = (id: string, documentId = "d1", position = 0): RetrievedPassage => ({
    id,
    documentId,
    position,
    content: `text of ${id}`,
    customerReady: id !== "held",
    place: id === "code" ? { kind: "page", label: "3" } : null,
})

const near = (id: string, similarity: number): NearPassage => ({ ...passage(id), similarity })

/** What the scripted source and embedding path were asked, in order. */
interface ScriptedCalls {
    /** The word searches: query and limit. */
    readonly words: Array<[string, number]>
    /** The vector searches: vector and limit. */
    readonly vector: Array<[ReadonlyArray<number>, number]>
    /** The texts sent to the embedding path. */
    readonly embed: Array<ReadonlyArray<string>>
    /** The passage ids whose cites were read. */
    readonly cites: Array<ReadonlyArray<string>>
}

/** A scripted store and a scripted embedding path: no provider is called. */
const scripted = (
    words: ReadonlyArray<RetrievedPassage>,
    meaning: ReadonlyArray<NearPassage>,
    vectors: ReadonlyArray<ReadonlyArray<number>> | null = [[0.1, 0.2]],
) => {
    const calls: ScriptedCalls = { words: [], vector: [], embed: [], cites: [] }
    const source: PassageSource = {
        byWords: (query, limit) => (calls.words.push([query, limit]), Promise.resolve(words)),
        byVector: (vector, limit) => (calls.vector.push([vector, limit]), Promise.resolve(meaning)),
        cites: (ids) => (
            calls.cites.push(ids),
            Promise.resolve(new Map([["d1", { title: DELIVERY_TITLE_VI, updatedAt: "2026-11-02T03:00:00.000Z", passages: 48 }]]))
        ),
    }
    const embed: EmbedTexts = (texts) => (calls.embed.push(texts), Promise.resolve(vectors))
    return { source, embed, calls }
}

const build = async (fields: ConstructorParameters<typeof PassageRetriever>[0]) => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: new PassageRetriever(fields) }],
    }).compile()
    return moduleRef.get<PassageRetriever>(SUBJECT)
}

describe("PassageRetriever", () => {
    it("is LangChain's retriever over LangChain's vector store and embeddings, answering Documents", async () => {
        const { source, embed } = scripted([passage("code")], [near("code", 0.9)])
        const store = new PassageVectorStore(new MeteredEmbeddings(embed), source.byVector)
        const retriever = await build({ source, store })

        const [first] = await retriever.invoke("SP-0123")

        expect(retriever).toBeInstanceOf(BaseRetriever)
        expect(store).toBeInstanceOf(VectorStore)
        expect(store.embeddings).toBeInstanceOf(Embeddings)
        expect(first).toBeInstanceOf(Document)
    })

    it("fuses the two legs by rank: found by both first, then each leg's own, ties by id; metadata carries the cite and the legs", async () => {
        const { source, embed, calls } = scripted(
            [passage("code"), passage("both"), passage("held")],
            [near("near", 0.82), near("both", 0.8)],
        )
        const retriever = await build({ source, store: new PassageVectorStore(new MeteredEmbeddings(embed), source.byVector) })

        const documents = await retriever.invoke(SHIPPING_FEE_QUERY_VI)

        expect(documents.map((document) => document.metadata.passageId)).toEqual(["both", "code", "near", "held"])
        expect(documents[0]).toMatchObject({
            id: "both",
            pageContent: "text of both",
            metadata: {
                passageId: "both",
                documentId: "d1",
                title: DELIVERY_TITLE_VI,
                updatedAt: "2026-11-02T03:00:00.000Z",
                documentPassages: 48,
                position: 0,
                place: null,
                customerReady: true,
                legs: ["words", "meaning"],
                wordRank: 2,
                meaningRank: 2,
                similarity: 0.8,
                score: 2 / (FUSION_K + 2),
            },
        })
        expect(documents[1]?.metadata).toMatchObject({ legs: ["words"], wordRank: 1, meaningRank: null, similarity: null, place: { kind: "page", label: "3" } })
        expect(documents[2]?.metadata).toMatchObject({ legs: ["meaning"], wordRank: null, meaningRank: 1, similarity: 0.82 })
        expect(documents[3]?.metadata).toMatchObject({ customerReady: false })
        // One embedding call, one statement per leg with the pool, one cite read for the documents found.
        expect(calls.embed).toEqual([[SHIPPING_FEE_QUERY_VI]])
        expect(calls.words).toEqual([[SHIPPING_FEE_QUERY_VI, 40]])
        expect(calls.vector).toEqual([[[0.1, 0.2], 40]])
        expect(calls.cites).toEqual([["d1"]])
    })

})

describe("PassageRetriever without a meaning leg", () => {
    it("searches by words alone with no store: nothing is embedded", async () => {
        const { source, embed, calls } = scripted([passage("code")], [near("near", 0.9)])
        const retriever = await build({ source, store: null, pool: 7 })

        const documents = await retriever.invoke("SP-0123")

        expect(documents.map((document) => document.metadata.legs)).toEqual([["words"]])
        expect(calls.words).toEqual([["SP-0123", 7]])
        expect(calls.vector).toEqual([])
        expect(embed).toBeDefined()
        expect(calls.embed).toEqual([])
    })

    it("degrades to words when the metered path has no vector (no credits, a failed call): the store is not asked", async () => {
        const { source, embed, calls } = scripted([passage("code")], [near("near", 0.9)], null)
        const store = new PassageVectorStore(new MeteredEmbeddings(embed), source.byVector)
        const retriever = await build({ source, store })

        const documents = await retriever.invoke(OPENING_HOURS_QUERY_VI)

        expect(documents.map((document) => document.metadata.passageId)).toEqual(["code"])
        expect(calls.embed).toEqual([[OPENING_HOURS_QUERY_VI]])
        expect(calls.vector).toEqual([])
    })

    it("has no argument that widens the lane: the store's filter is not read, and it refuses to write", async () => {
        const { source, embed, calls } = scripted([], [near("near", 0.9)])
        const store = new PassageVectorStore(new MeteredEmbeddings(embed), source.byVector)

        const found = await store.similaritySearchVectorWithScore([1, 2, 3], 5)

        expect(found.map(([document, score]) => [document.id, document.pageContent, score])).toEqual([["near", "text of near", 0.9]])
        expect(calls.vector).toEqual([[[1, 2, 3], 5]])
        await expect(store.similaritySearchVectorWithScore([], 5)).resolves.toEqual([])
        await expect(store.addDocuments()).rejects.toThrow("read-only")
        await expect(store.addVectors()).rejects.toThrow("read-only")
        expect(store._vectorstoreType()).toBe("nivo-passages")
    })

    it("reports its run to the callbacks of the caller, as any LangChain retriever does", async () => {
        const { source } = scripted([passage("code")], [])
        const retriever = await build({ source, store: null })
        const seen: Array<string> = []

        await retriever.invoke("SP-0123", {
            callbacks: [
                {
                    handleRetrieverStart: (_retriever, query) => void seen.push(`start:${query}`),
                    handleRetrieverEnd: (documents) => void seen.push(`end:${documents.length}`),
                },
            ],
        })

        expect(seen).toEqual(["start:SP-0123", "end:1"])
    })
})

describe("PassageRetriever exact answers", () => {
    it("counts a word hit that holds every word of the query twice, so passages only near in meaning do not push it down", async () => {
        const { source, embed } = scripted(
            [passage("some"), { ...passage("all"), complete: true }],
            [near("n1", 0.9), near("n2", 0.85), near("n3", 0.8)],
        )
        const retriever = await build({ source, store: new PassageVectorStore(new MeteredEmbeddings(embed), source.byVector) })

        const documents = await retriever.invoke("mau don nu khong no")

        // all: 2 / (60 + 2) > 1 / 61; "some" (first of the word leg, not complete) ties with the first of the meaning leg.
        expect(documents.map((document) => [document.metadata.passageId, document.metadata.score])).toEqual([
            ["all", 2 / (FUSION_K + 2)],
            ["n1", 1 / (FUSION_K + 1)],
            ["some", 1 / (FUSION_K + 1)],
            ["n2", 1 / (FUSION_K + 2)],
            ["n3", 1 / (FUSION_K + 3)],
        ])
    })

    it("keeps the passages holding every word first in the word leg's order, whatever the meaning leg found of them", async () => {
        const { source, embed } = scripted(
            [{ ...passage("first"), complete: true }, { ...passage("second"), complete: true }, passage("some")],
            [near("n1", 0.9), near("second", 0.88)],
        )
        const retriever = await build({ source, store: new PassageVectorStore(new MeteredEmbeddings(embed), source.byVector) })

        const documents = await retriever.invoke("SP-0154 hong gi")

        // Fused alone, "second" (both legs) would outrank "first" (the word leg's first): exact answers keep the word order.
        expect(documents.map((document) => document.metadata.passageId)).toEqual(["first", "second", "n1", "some"])
    })
})
