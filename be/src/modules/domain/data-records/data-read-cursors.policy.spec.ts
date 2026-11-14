import { Test } from "@nestjs/testing"
import { cursorKeyOf, isForward, seenThroughOf } from "./data-read-cursors.policy"

const SUBJECT = Symbol("data-read-cursors.policy")

const P1 = "2026-11-11T10:00:00.100000Z~11111111-1111-4111-8111-111111111111"
const P2 = "2026-11-11T10:00:00.200000Z~22222222-2222-4222-8222-222222222222"
const P3 = "2026-11-11T10:00:01.000000Z~33333333-3333-4333-8333-333333333333"

/** The policy's functions as the spec reads them, through the testing module. */
interface Subject {
    readonly cursorKeyOf: typeof cursorKeyOf
    readonly isForward: typeof isForward
    readonly seenThroughOf: typeof seenThroughOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cursorKeyOf, isForward, seenThroughOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("data-read-cursors.policy", () => {
    it("orders fixed-width points by time, then by row id, and moves a cursor that holds none", async () => {
        const { isForward } = await build()

        expect(isForward(null, P1)).toBe(true)
        expect(isForward(P1, P2)).toBe(true)
        expect(isForward(P2, P1)).toBe(false)
        expect(isForward(P2, P2)).toBe(false)
        expect(isForward(P2, P3)).toBe(true)
    })

    it("keys a reader by agent and entity and reads a saved point only when it is a text", async () => {
        const { cursorKeyOf, seenThroughOf } = await build()

        expect(cursorKeyOf({ workspaceId: "ws-1", agentId: "agent-1", entity: "message" })).toBe("agent-1:message")
        expect(seenThroughOf({ seenThrough: P1 })).toBe(P1)
        expect(seenThroughOf({ seenThrough: "" })).toBeNull()
        expect(seenThroughOf({})).toBeNull()
    })
})
