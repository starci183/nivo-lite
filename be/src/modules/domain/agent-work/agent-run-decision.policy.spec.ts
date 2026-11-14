import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { SEND_QUOTE_VI } from "@tests/fixtures/i18n/agent-work-spec.messages"
import { decidingItemIdOf, decisionOf, optionsOf, verdictOf } from "./agent-run-decision.policy"
import type { AgentRunItem, AgentRunStepLine } from "./agent-runs-view.contracts"

const SUBJECT = Symbol("agent-run-decision.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { decidingItemIdOf, decisionOf, optionsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-run-decision.policy")>(SUBJECT)
}

const stepOf: (patch?: Partial<AgentRunStepLine>) => AgentRunStepLine = builder<AgentRunStepLine>({
    stepKey: "ask",
    nodeKey: "ask",
    ordinal: 1,
    status: "waiting",
    attempt: 1,
    maxAttempts: 3,
    startedAt: null,
    durationMs: null,
    errorCode: null,
    workItemId: "wi-1",
    input: [],
    output: [],
    calls: [],
})

const itemOf: (patch?: Partial<AgentRunItem>) => AgentRunItem = builder<AgentRunItem>({
    id: "wi-1",
    action: "approve_order",
    summary: SEND_QUOTE_VI,
    status: "waiting_decision",
    reason: null,
    evidence: [],
    error: null,
})

describe("optionsOf", () => {
    it("offers approve and reject for an ordinary item", async () => {
        const subject = await build()
        expect(subject.optionsOf("approve_order")).toEqual(["approve", "reject"])
    })

    it.each(["connect_sepay", "grant_payment_tool"])("offers retry and reject for %s", async (action) => {
        const subject = await build()
        expect(subject.optionsOf(action)).toEqual(["retry", "reject"])
    })
})

describe("decidingItemIdOf", () => {
    it("is the item the waiting step names", async () => {
        const subject = await build()
        expect(subject.decidingItemIdOf([stepOf({})], null)).toBe("wi-1")
    })

    it("is the item the run is about when it waits and no step does", async () => {
        const subject = await build()
        expect(subject.decidingItemIdOf([stepOf({ status: "done", workItemId: null })], itemOf({ id: "wi-2" }))).toBe("wi-2")
    })

    it("is nothing when neither waits", async () => {
        const subject = await build()
        expect(subject.decidingItemIdOf([stepOf({ status: "done" })], itemOf({ status: "done" }))).toBeNull()
    })
})

describe("decisionOf", () => {
    it("names the decision, its step, its title and its answers", async () => {
        const subject = await build()
        expect(subject.decisionOf([stepOf({})], itemOf({}))).toEqual({
            decisionId: "wi-1",
            workItemId: "wi-1",
            stepKey: "ask",
            title: SEND_QUOTE_VI,
            options: ["approve", "reject"],
        })
    })

    it("has no step when the run is only about the item", async () => {
        const subject = await build()
        expect(subject.decisionOf([stepOf({ status: "done", workItemId: null })], itemOf({}))?.stepKey).toBeNull()
    })

    it("is nothing for an item that does not wait for a person", async () => {
        const subject = await build()
        expect(subject.decisionOf([stepOf({})], itemOf({ status: "done" }))).toBeNull()
    })
})

describe("verdictOf", () => {
    const PERMISSION = "approve_tool_call"
    const NOT_OFFERED = { kind: "not_offered", accepted: ["approve", "reject"] }

    it("reads approve as the approval and reject as the refusal of a permission request", () => {
        expect(verdictOf(PERMISSION, "approve")).toEqual({ kind: "approve" })
        expect(verdictOf(PERMISSION, "reject")).toEqual({ kind: "reject" })
    })

    it.each(["retry", "", "decline", "refuse", "APPROVE", "approve ", "yes"])(
        "never reads %p as an approval of a permission request: it is no answer, and the verdicts taken are named",
        (word) => {
            expect(verdictOf(PERMISSION, word)).toEqual(NOT_OFFERED)
        },
    )

    it("takes retry only for an item that only wants another try, where approve is no answer", () => {
        expect(verdictOf("connect_sepay", "retry")).toEqual({ kind: "approve" })
        expect(verdictOf("connect_sepay", "reject")).toEqual({ kind: "reject" })
        expect(verdictOf("connect_sepay", "approve")).toEqual({ kind: "not_offered", accepted: ["retry", "reject"] })
    })
})
