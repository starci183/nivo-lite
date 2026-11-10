import { Test } from "@nestjs/testing"
import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { chunkHashOf as realChunkHashOf, foldedPassagesOf as realFoldedPassagesOf } from "./chunk-provenance.policy"

const SUBJECT = Symbol("chunk-provenance.policy")

/** The policy as a Nest value. */
interface Policy {
    readonly chunkHashOf: typeof realChunkHashOf
    readonly foldedPassagesOf: typeof realFoldedPassagesOf
}

const build = async (): Promise<Policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { chunkHashOf: realChunkHashOf, foldedPassagesOf: realFoldedPassagesOf } }],
    }).compile()
    return moduleRef.get<Policy>(SUBJECT)
}

/** Two passages of a Vietnamese delivery rule (opening hours, the city shipping fee), accents written as escapes. */
const HOURS = "## Gi\u1EDD l\u00E0m vi\u1EC7c\nM\u1EDF c\u1EEDa 8:00-20:00."
const SHIP = "## Ph\u00ED ship\nN\u1ED9i th\u00E0nh 30.000 \u0111."

describe("chunk-provenance.policy", () => {
    it("names the passage that holds the quote (accents and case ignored)", async () => {
        const policy = await build()
        const passages = policy.foldedPassagesOf([
            { text: HOURS, hash: passageTextHashOf(HOURS) },
            { text: SHIP, hash: passageTextHashOf(SHIP) },
        ])

        expect(policy.chunkHashOf("noi thanh 30.000 D", passages)).toBe(passageTextHashOf(SHIP))
        expect(policy.chunkHashOf("M\u1EDF c\u1EEDa 8:00", passages)).toBe(passageTextHashOf(HOURS))
    })

    it("names none for a quote no single passage holds, or one too short to prove anything", async () => {
        const policy = await build()
        const passages = policy.foldedPassagesOf([
            { text: HOURS, hash: passageTextHashOf(HOURS) },
            { text: SHIP, hash: passageTextHashOf(SHIP) },
        ])

        expect(policy.chunkHashOf("20:00. ## Phi ship", passages)).toBeNull()
        expect(policy.chunkHashOf("8", passages)).toBeNull()
    })
})
