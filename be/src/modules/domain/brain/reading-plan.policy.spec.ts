import { Test } from "@nestjs/testing"
import { chunkPassages, passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { windowsOf } from "./extraction.policy"
import { readingPlanOf } from "./reading-plan.policy"

const SUBJECT = Symbol("reading-plan.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readingPlanOf } }],
    }).compile()
    return moduleRef.get<{ readingPlanOf: typeof readingPlanOf }>(SUBJECT)
}

const TEXT = "## Hours\nOpen 8 to 21.\n## Fees\nA visit is 100k.\n## Refunds\nWithin 7 days."
const hashesOf = (text: string) => chunkPassages(text).map(passageTextHashOf)

describe("readingPlanOf", () => {
    it("reads the whole document when nothing was read before", async () => {
        const subject = await build()

        expect(subject.readingPlanOf(TEXT, [])).toEqual({
            partial: false,
            hashes: hashesOf(TEXT),
            unchangedText: "",
            windows: windowsOf(TEXT),
        })
    })

    it("reads the whole document when no passage is known, whatever was read", async () => {
        const subject = await build()

        expect(subject.readingPlanOf(TEXT, ["other"]).windows).toEqual(windowsOf(TEXT))
    })

    it("reads only the changed passage, and names the others as what facts may rest on", async () => {
        const subject = await build()
        const edited = TEXT.replace("100k", "120k")

        const plan = subject.readingPlanOf(edited, hashesOf(TEXT))

        expect(plan.partial).toBe(true)
        expect(plan.windows).toEqual(["## Fees\nA visit is 120k."])
        expect(plan.unchangedText).toBe("## Hours\nOpen 8 to 21. ## Refunds\nWithin 7 days.")
        expect(plan.hashes).toEqual(hashesOf(edited))
    })

    it("reads nothing when passages only moved or went", async () => {
        const subject = await build()
        const shorter = "## Refunds\nWithin 7 days.\n## Hours\nOpen 8 to 21."

        const plan = subject.readingPlanOf(shorter, hashesOf(TEXT))

        expect(plan.windows).toEqual([])
        expect(plan.partial).toBe(true)
    })
})
