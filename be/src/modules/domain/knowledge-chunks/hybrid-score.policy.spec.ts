import { hybridHit, hybridScore } from "./hybrid-score.policy"

describe("hybrid score", () => {
    it("scores a row with both halves, the vector half only for the query model", () => {
        const score = hybridScore("c", { vector: true, text: true })

        expect(score).toContain("c.embeddingModel = :model")
        expect(score).toContain("* 0.7")
        expect(score).toContain("ts_rank(c.fts, to_tsquery('simple', :tsquery))) * 0.3")
        expect(score.startsWith("CAST((")).toBe(true)
        expect(score.endsWith(") AS real)")).toBe(true)
    })

    it("leaves out the half that has no input", () => {
        expect(hybridScore("k", { vector: false, text: true })).toBe(
            "CAST((0 + least(1, ts_rank(k.fts, to_tsquery('simple', :tsquery))) * 0.3) AS real)",
        )
        expect(hybridScore("k", { vector: true, text: false })).not.toContain("ts_rank")
        expect(hybridScore("k", { vector: false, text: false })).toBe("CAST((0 + 0) AS real)")
    })

    it("hits on a close vector or a word match", () => {
        expect(hybridHit("c", { vector: true, text: true })).toBe(
            "((c.embedding IS NOT NULL AND c.embeddingModel = :model AND (c.embedding <=> CAST(:vector AS extensions.vector)) < 0.8) OR c.fts @@ to_tsquery('simple', :tsquery))",
        )
        expect(hybridHit("c", { vector: false, text: true })).toBe("(c.fts @@ to_tsquery('simple', :tsquery))")
        expect(hybridHit("c", { vector: true, text: false })).toContain("< 0.8")
        expect(hybridHit("c", { vector: false, text: false })).toBe("false")
    })
})
