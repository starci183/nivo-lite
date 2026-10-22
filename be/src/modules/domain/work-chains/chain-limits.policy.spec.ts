import { Test } from "@nestjs/testing"
import { automaticRun, judgeStep } from "./chain-limits.policy"
import type { JudgedStep } from "./work-chains.contracts"

const SUBJECT = Symbol("chain-limits.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { automaticRun, judgeStep } }],
    }).compile()
    return moduleRef.get<typeof import("./chain-limits.policy")>(SUBJECT)
}

const agentStep = (agent: string, target: string | null, action = "Check invoice"): JudgedStep => ({
    actor: { kind: "agent", id: agent },
    kind: target === null ? "self" : "hand_off",
    action,
    target: target === null ? null : { kind: "agent", id: target },
})

const memberStep = (member: string): JudgedStep => ({
    actor: { kind: "member", id: member },
    kind: "self",
    action: "Fix tax code",
    target: null,
})

const agentsRun = (count: number): Array<JudgedStep> =>
    Array.from({ length: count }, (_, index) => agentStep(`a${index}`, null))

const registerAutomaticRun = () => {
    describe("automaticRun", () => {
        it("keeps only the steps after the last person's step", async () => {
            const subject = await buildSubject()
            const history = [agentStep("a", null), memberStep("m"), agentStep("b", null), agentStep("c", null)]

            expect(subject.automaticRun(history)).toEqual([agentStep("b", null), agentStep("c", null)])
        })

        it("keeps the whole history when no person acted", async () => {
            const subject = await buildSubject()
            const history = [agentStep("a", null), agentStep("b", null)]

            expect(subject.automaticRun(history)).toEqual(history)
        })
    })
}

const registerLimit = () => {
    describe("judgeStep and the automatic limit", () => {
        it("lets a person's step go on whatever the history says", async () => {
            const subject = await buildSubject()

            expect(subject.judgeStep(agentsRun(20), memberStep("m"))).toEqual({ kind: "continue" })
        })

        it("lets an agent take the twelfth automatic step", async () => {
            const subject = await buildSubject()

            expect(subject.judgeStep(agentsRun(11), agentStep("z", null))).toEqual({ kind: "continue" })
        })

        it("stops an agent that would take a thirteenth automatic step", async () => {
            const subject = await buildSubject()

            expect(subject.judgeStep(agentsRun(12), agentStep("z", null))).toEqual({ kind: "stop", reason: "limit" })
        })

        it("starts the count again after a person acted", async () => {
            const subject = await buildSubject()
            const history = [...agentsRun(12), memberStep("m")]

            expect(subject.judgeStep(history, agentStep("z", null))).toEqual({ kind: "continue" })
        })
    })
}

const registerLoops = () => {
    describe("judgeStep and the loop check", () => {
        it("lets two agents hand the same work to each other once each", async () => {
            const subject = await buildSubject()

            expect(subject.judgeStep([agentStep("a", "b")], agentStep("b", "a"))).toEqual({ kind: "continue" })
        })

        it("stops the third repeat of the same pair doing the same action, in either direction", async () => {
            const subject = await buildSubject()
            const history = [agentStep("a", "b"), agentStep("b", "a")]

            expect(subject.judgeStep(history, agentStep("a", "b", "  CHECK invoice "))).toEqual({
                kind: "stop",
                reason: "loop",
            })
        })

        it("does not call it a loop when the action differs", async () => {
            const subject = await buildSubject()
            const history = [agentStep("a", "b"), agentStep("b", "a")]

            expect(subject.judgeStep(history, agentStep("a", "b", "Send confirmation"))).toEqual({ kind: "continue" })
        })

        it("does not call it a loop when another pair did the same action", async () => {
            const subject = await buildSubject()
            const history = [agentStep("a", "c"), agentStep("c", "a")]

            expect(subject.judgeStep(history, agentStep("a", "b"))).toEqual({ kind: "continue" })
        })

        it("forgets the repeats a person broke up", async () => {
            const subject = await buildSubject()
            const history = [agentStep("a", "b"), agentStep("b", "a"), memberStep("m")]

            expect(subject.judgeStep(history, agentStep("a", "b"))).toEqual({ kind: "continue" })
        })
    })
}

describe("chain limits policy", () => {
    registerAutomaticRun()
    registerLimit()
    registerLoops()
})
