import { Test } from "@nestjs/testing"
import { shiftsJobOf } from "./shift-jobs.policy"

const SUBJECT = Symbol("shift-jobs.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { shiftsJobOf } }],
    }).compile()
    return moduleRef.get<typeof import("./shift-jobs.policy")>(SUBJECT)
}

describe("shiftsJobOf", () => {
    it("reads a tick, a reminder and a no-show check", async () => {
        const subject = await build()

        expect(subject.shiftsJobOf({ kind: "tick" })).toEqual({ kind: "tick" })
        expect(subject.shiftsJobOf({ kind: "remind", workspaceId: "w", shiftId: "s", extra: 1 })).toEqual({
            kind: "remind",
            workspaceId: "w",
            shiftId: "s",
        })
        expect(subject.shiftsJobOf({ kind: "noshow", workspaceId: "w", shiftId: "s" })).toEqual({
            kind: "noshow",
            workspaceId: "w",
            shiftId: "s",
        })
    })

    it.each([
        undefined,
        null,
        "tick",
        [],
        {},
        { kind: "other" },
        { kind: "remind", workspaceId: "w" },
        { kind: "noshow", shiftId: 1 },
    ])("drops %p", async (payload) => {
        const subject = await build()

        expect(subject.shiftsJobOf(payload)).toBeNull()
    })
})
