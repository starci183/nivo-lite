import { Test } from "@nestjs/testing"
import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { factEmbedHashOf as realFactEmbedHashOf, factEmbedTextOf as realFactEmbedTextOf, needsEmbedding as realNeedsEmbedding, sameIdentity as realSameIdentity } from "./embedding-standard.policy"

const IDENTITY = { model: "embed", dimensions: 3 }


const SUBJECT = Symbol("embedding-standard.policy")



describe("embedding-standard.policy as a Nest value", () => {
    let factEmbedHashOf: typeof realFactEmbedHashOf
    let factEmbedTextOf: typeof realFactEmbedTextOf
    let needsEmbedding: typeof realNeedsEmbedding
    let sameIdentity: typeof realSameIdentity

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: { factEmbedHashOf: realFactEmbedHashOf, factEmbedTextOf: realFactEmbedTextOf, needsEmbedding: realNeedsEmbedding, sameIdentity: realSameIdentity } }],
        }).compile()
        const subject = moduleRef.get<{ factEmbedHashOf: typeof realFactEmbedHashOf; factEmbedTextOf: typeof realFactEmbedTextOf; needsEmbedding: typeof realNeedsEmbedding; sameIdentity: typeof realSameIdentity }>(SUBJECT)
        factEmbedHashOf = subject.factEmbedHashOf
        factEmbedTextOf = subject.factEmbedTextOf
        needsEmbedding = subject.needsEmbedding
        sameIdentity = subject.sameIdentity
    })

    describe("embedding-standard.policy", () => {
        const fact = { subjectLabel: "Phi ship", attributeLabel: "noi thanh", value: "30.000", unit: "d" }

        it("embeds one line of the fact and keys it with the passage hash of that line, the rule a document chunk follows", () => {
            expect(factEmbedTextOf(fact)).toBe("Phi ship - noi thanh: 30.000 d")
            expect(factEmbedHashOf(fact)).toBe(passageTextHashOf("Phi ship - noi thanh: 30.000 d"))
            expect(factEmbedHashOf({ ...fact, unit: null })).not.toBe(factEmbedHashOf(fact))
        })

        it("does not embed again a line with the same hash under the same identity", () => {
            const hash = factEmbedHashOf(fact)

            expect(needsEmbedding({ model: "embed", dimensions: 3, hash }, hash, IDENTITY)).toBe(false)
        })

        it.each([
            ["no vector yet", { model: null, dimensions: null, hash: null }],
            ["another profile", { model: "embed-v2", dimensions: 3, hash: "h" }],
            ["other dimensions", { model: "embed", dimensions: 1536, hash: "h" }],
            ["a changed line", { model: "embed", dimensions: 3, hash: "old" }],
        ])("embeds again for %s", (_name, stored) => {
            expect(needsEmbedding(stored, "h", IDENTITY)).toBe(true)
        })

        it("calls two vectors comparable only when profile and dimensions are both the same", () => {
            expect(sameIdentity({ model: "embed", dimensions: 3 }, IDENTITY)).toBe(true)
            expect(sameIdentity({ model: "embed", dimensions: 4 }, IDENTITY)).toBe(false)
            expect(sameIdentity({ model: "other", dimensions: 3 }, IDENTITY)).toBe(false)
        })
    })
})
