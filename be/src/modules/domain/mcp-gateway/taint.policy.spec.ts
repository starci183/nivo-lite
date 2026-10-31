import { Test } from "@nestjs/testing"
import type { GatewayCaller } from "./mcp-gateway.contracts"
import { isTainted, TAINT_WINDOW_MS, turnKeyOf, withTaint } from "./taint.policy"

/** The members of the subject under test. */
interface Subject {
    readonly isTainted: typeof isTainted
    readonly turnKeyOf: typeof turnKeyOf
    readonly withTaint: typeof withTaint
}

const SUBJECT = Symbol("taint.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isTainted, turnKeyOf, withTaint } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CALLER: GatewayCaller = { workspaceId: "w1", agentId: "a1", conversationId: null, workItemId: null }

describe("taint.policy", () => {
    it("names the turn by turn id, else conversation, else work item, else the agent's session on the door", async () => {
        const subject = await build()

        expect(subject.turnKeyOf({ ...CALLER, turnId: "t1", conversationId: "c1" })).toBe("w1:a1:t1")
        expect(subject.turnKeyOf({ ...CALLER, conversationId: "c1", workItemId: "i1" })).toBe("w1:a1:c1")
        expect(subject.turnKeyOf({ ...CALLER, workItemId: "i1" })).toBe("w1:a1:i1")
        expect(subject.turnKeyOf(CALLER)).toBe("w1:a1:door")
    })

    it("taints a turn from the moment it read tainted text until the window ends, and no other turn", async () => {
        const subject = await build()
        const marks = subject.withTaint(new Map(), CALLER, 1000)

        expect(subject.isTainted(marks, CALLER, 1000 + TAINT_WINDOW_MS)).toBe(true)
        expect(subject.isTainted(marks, CALLER, 1001 + TAINT_WINDOW_MS)).toBe(false)
        expect(subject.isTainted(marks, { ...CALLER, agentId: "a2" }, 2000)).toBe(false)
        expect(subject.isTainted(marks, { ...CALLER, conversationId: "c9" }, 2000)).toBe(false)
        expect(subject.isTainted(marks, { ...CALLER, turnId: "t2" }, 2000)).toBe(false)
        expect(subject.isTainted(new Map(), CALLER, 2000)).toBe(false)
    })

    it("drops the marks that ran out when it adds one", async () => {
        const subject = await build()
        const old = subject.withTaint(new Map(), { ...CALLER, agentId: "old" }, 0)

        const marks = subject.withTaint(old, CALLER, TAINT_WINDOW_MS + 5)

        expect([...marks.keys()]).toEqual(["w1:a1:door"])
    })
})
