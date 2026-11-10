import { toAgentRunStopDecisionType, toDecideRunStopRequest } from "./decide-run-stop.mapper"

describe("decide-run-stop.mapper", () => {
    it("maps the arguments to the request, with the step and the words null when absent", () => {
        expect(toDecideRunStopRequest("ws-1", { runId: "run-1", action: "retry" })).toEqual({
            workspaceId: "ws-1",
            runId: "run-1",
            stepKey: null,
            action: "retry",
            text: null,
        })
        expect(toDecideRunStopRequest("ws-1", { runId: "run-1", stepKey: "match", action: "answer", text: "Của DH-1" })).toEqual({
            workspaceId: "ws-1",
            runId: "run-1",
            stepKey: "match",
            action: "answer",
            text: "Của DH-1",
        })
    })

    it("maps the answer to the GraphQL type", () => {
        expect(toAgentRunStopDecisionType({ outcome: "stop_closed", stepKey: "match" })).toEqual({
            outcome: "stop_closed",
            stepKey: "match",
        })
    })
})
