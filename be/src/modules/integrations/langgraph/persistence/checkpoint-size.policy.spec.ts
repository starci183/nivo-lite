import { Test } from "@nestjs/testing"
import { DEFAULT_CHECKPOINT_LIMITS, listLimitOf, sizeOf } from "./checkpoint-size.policy"

/** The members of the subject under test. */
interface Subject {
    readonly sizeOf: typeof sizeOf
    readonly listLimitOf: typeof listLimitOf
}

const SUBJECT = Symbol("checkpoint-size.policy")
const LIMITS = { warnBytes: 100, maxBytes: 1000, listMax: 50 }

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sizeOf, listLimitOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("checkpoint-size.policy", () => {
    it.each([
        [0, "fine"],
        [99, "fine"],
        [100, "large"],
        [1000, "large"],
        [1001, "refused"],
    ])("reads %d bytes as %s", async (bytes, size) => {
        const subject = await build()

        expect(subject.sizeOf(bytes, LIMITS)).toBe(size)
    })

    it.each([
        [undefined, 50],
        [0, 0],
        [7, 7],
        [50, 50],
        [51, 50],
        [-1, 50],
        [2.5, 50],
    ])("bounds a list asked with limit %s to %d", async (asked, limit) => {
        const subject = await build()

        expect(subject.listLimitOf(asked, LIMITS)).toBe(limit)
    })

    it("warns from a quarter of a megabyte, refuses above four, lists at most a thousand by default", () => {
        expect(DEFAULT_CHECKPOINT_LIMITS).toEqual({ warnBytes: 262_144, maxBytes: 4_194_304, listMax: 1000 })
    })
})
