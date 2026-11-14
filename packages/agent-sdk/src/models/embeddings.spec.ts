import { EMBEDDING_PROFILE, EMBEDDING_PROFILES, embeddingIdentityOf } from "./embeddings"

describe("the embedding identity (W2 embedding standard: a vector records its model identity, never the profile name)", () => {
    it("makes `embed-oa` the profile of OpenAI text-embedding-3-small at 1536 dimensions", () => {
        expect(EMBEDDING_PROFILE).toBe("embed-oa")
        expect(EMBEDDING_PROFILES[EMBEDDING_PROFILE]).toEqual({ model: "text-embedding-3-small", dimensions: 1536 })
    })

    it("records the model and its dimensions for a known profile", () => {
        expect(embeddingIdentityOf("embed-oa")).toBe("text-embedding-3-small@1536")
    })

    it("never lets the old profile name (or any unknown name) equal a known identity: its vectors read as stale", () => {
        expect(embeddingIdentityOf("embed")).toBe("profile:embed")
        expect(Object.keys(EMBEDDING_PROFILES).map((name) => embeddingIdentityOf(name))).not.toContain(embeddingIdentityOf("embed"))
    })
})
