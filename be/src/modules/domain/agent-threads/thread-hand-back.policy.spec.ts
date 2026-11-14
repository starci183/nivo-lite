import { handedOffByOf } from "./thread-hand-back.policy"

// Owed since R30 (ROAD Opus-1f, 2026-11-14): the hand-off's right to speak (`NodeTurn.handedOffBy`) of a DELIVERED workflow call comes
// from the trigger scope's `caller.agent`, which `deliver` writes (from `DeliveredEvent.caller`) and the flow completes with the workflow.
describe("handedOffByOf: the agent that handed a run off", () => {
    it("is the delivered call's `caller.agent`", () => {
        const scope = {
            eventId: "call:run-c",
            data: { orderId: "o-1" },
            caller: { agent: "agent-chatbot", workflow: "chatbot.front-desk", runId: "run-c" },
        }
        expect(handedOffByOf(scope)).toBe("agent-chatbot")
    })

    it("is the wake's calling agent (`authorAgentId`) when the scope names no caller agent", () => {
        expect(handedOffByOf({ eventId: "e-1", data: {}, caller: { agent: null, runId: "run-c" }, authorAgentId: "agent-sales" })).toBe(
            "agent-sales",
        )
    })

    it("is null for a run no agent handed off: a customer's line, a person's start, a blank caller", () => {
        expect(handedOffByOf({ eventId: "zalo:m-1", routeId: "route-1", data: { text: "hi" } })).toBeNull()
        expect(handedOffByOf({ eventId: "start:1", data: {}, caller: null })).toBeNull()
        expect(handedOffByOf({ eventId: "call:x", data: {}, caller: { agent: "" }, authorAgentId: "" })).toBeNull()
    })
})
