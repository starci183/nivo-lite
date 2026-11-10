import { decidingItemIdOf, decisionOf, optionsOf } from "./agent-run-decision.policy"
import type { AgentRunItem, AgentRunStepLine } from "./read-agent-runs.contracts"

const stepOf = (patch: Partial<AgentRunStepLine>): AgentRunStepLine => ({
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
    ...patch,
})

const itemOf = (patch: Partial<AgentRunItem>): AgentRunItem => ({
    id: "wi-1",
    action: "approve_order",
    summary: "Gửi báo giá",
    status: "waiting_decision",
    reason: null,
    evidence: [],
    error: null,
    ...patch,
})

describe("optionsOf", () => {
    it("offers approve and reject for an ordinary item", () => {
        expect(optionsOf("approve_order")).toEqual(["approve", "reject"])
    })

    it.each(["connect_sepay", "grant_payment_tool"])("offers retry and reject for %s", (action) => {
        expect(optionsOf(action)).toEqual(["retry", "reject"])
    })
})

describe("decidingItemIdOf", () => {
    it("is the item the waiting step names", () => {
        expect(decidingItemIdOf([stepOf({})], null)).toBe("wi-1")
    })

    it("is the item the run is about when it waits and no step does", () => {
        expect(decidingItemIdOf([stepOf({ status: "done", workItemId: null })], itemOf({ id: "wi-2" }))).toBe("wi-2")
    })

    it("is nothing when neither waits", () => {
        expect(decidingItemIdOf([stepOf({ status: "done" })], itemOf({ status: "done" }))).toBeNull()
    })
})

describe("decisionOf", () => {
    it("names the decision, its step, its title and its answers", () => {
        expect(decisionOf([stepOf({})], itemOf({}), null)).toEqual({
            decisionId: "wi-1",
            workItemId: "wi-1",
            stepKey: "ask",
            title: "Gửi báo giá",
            options: ["approve", "reject"],
        })
    })

    it("answers the open request of the group when the graph asked one", () => {
        expect(decisionOf([stepOf({})], itemOf({}), "req-1")?.decisionId).toBe("req-1")
    })

    it("has no step when the run is only about the item", () => {
        expect(decisionOf([stepOf({ status: "done", workItemId: null })], itemOf({}), null)?.stepKey).toBeNull()
    })

    it("is nothing for an item that does not wait for a person", () => {
        expect(decisionOf([stepOf({})], itemOf({ status: "done" }), null)).toBeNull()
    })
})
