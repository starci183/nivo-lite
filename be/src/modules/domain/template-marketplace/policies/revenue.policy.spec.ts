import { Test } from "@nestjs/testing"
import { splitOf } from "./revenue.policy"

const SUBJECT = Symbol("revenue.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { splitOf } }],
    }).compile()
    return moduleRef.get<{ splitOf: typeof splitOf }>(SUBJECT)
}

describe("splitOf", () => {
    it("gives the creator the percent rounded down and the platform the rest, so not a dong is lost", async () => {
        const subject = await build()

        expect(subject.splitOf(1_000_000, 70)).toEqual({ creator: 700_000, platform: 300_000 })
        expect(subject.splitOf(999, 70)).toEqual({ creator: 699, platform: 300 })
        expect(subject.splitOf(1, 70)).toEqual({ creator: 0, platform: 1 })
    })

    it("handles a whole sale to either side", async () => {
        const subject = await build()

        expect(subject.splitOf(500_000, 100)).toEqual({ creator: 500_000, platform: 0 })
        expect(subject.splitOf(500_000, 0)).toEqual({ creator: 0, platform: 500_000 })
    })
})
