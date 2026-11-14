import { Test } from "@nestjs/testing"
import { TRUTH_CEILING, fits, roomOf, taken, truthBytesOf } from "./truth-ceiling.policy"
import { D_VI, GIAO_HANG_NOI_THANHPHI_SHIP30_000D_VI, GIAO_HANG_NOI_THANH_VI, PHI_SHIP_2_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"

const SUBJECT = Symbol("truth-ceiling.policy")

/** The policy's own functions, provided through a testing module the way Nest builds a subject. */
const build = async (): Promise<typeof import("./truth-ceiling.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fits, roomOf, taken, truthBytesOf } }],
    }).compile()
    return moduleRef.get<typeof import("./truth-ceiling.policy")>(SUBJECT)
}

describe("truth-ceiling.policy: the ceiling of truths in force per business", () => {
    let subject: typeof import("./truth-ceiling.policy")

    beforeEach(async () => {
        subject = await build()
    })

    it("opens at the tested level of 5,000 truths under the owner's target of 2 MB of truth text", () => {
        expect(TRUTH_CEILING).toEqual({ truths: 5_000, bytes: 2_097_152 })
    })

    it("says which bound binds: the count today, the bytes once the count is raised to about 20,000", () => {
        const line = { subjectLabel: GIAO_HANG_NOI_THANH_VI, attributeLabel: PHI_SHIP_2_VI, value: "30.000", unit: D_VI }
        const bytes = subject.truthBytesOf(line)
        expect(bytes).toBe(Buffer.byteLength(GIAO_HANG_NOI_THANHPHI_SHIP30_000D_VI, "utf8"))
        // 5,000 truths of this size are far under 2 MB: the count is reached first.
        expect(TRUTH_CEILING.truths * bytes).toBeLessThan(TRUTH_CEILING.bytes)
        expect(subject.roomOf({ truths: 5_000, bytes: 5_000 * bytes })).toEqual({ truths: 0, bytes: TRUTH_CEILING.bytes - 5_000 * bytes })
        // With the count raised, the bytes stop it.
        const raised = { truths: 100_000, bytes: TRUTH_CEILING.bytes }
        expect(subject.roomOf({ truths: 20_000, bytes: 2_097_100 }, raised)).toEqual({ truths: 80_000, bytes: 52 })
        expect(subject.fits(subject.roomOf({ truths: 20_000, bytes: 2_097_100 }, raised), 60)).toBe(false)
    })

    it("counts the room down truth by truth and never below nothing", () => {
        const room = subject.roomOf({ truths: 4_999, bytes: 1_000 })
        expect(subject.fits(room, 100)).toBe(true)
        const after = subject.taken(room, 100)
        expect(after).toEqual({ truths: 0, bytes: TRUTH_CEILING.bytes - 1_100 })
        expect(subject.fits(after, 100)).toBe(false)
        expect(subject.roomOf({ truths: 9_000, bytes: 9_000_000 })).toEqual({ truths: 0, bytes: 0 })
        expect(subject.taken({ truths: 0, bytes: 10 }, 50)).toEqual({ truths: 0, bytes: 0 })
    })
})
