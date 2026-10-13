import type { FlowResult } from "@modules/domain/flows"
import type { RunFlowRequest } from "./dto/run-flow.request"
import { toFlowRequest, toRunFlowResponse } from "./flows.mapper"

describe("flows mapper", () => {
    it("maps the command kind and preserves its payload", () => {
        const input: RunFlowRequest = { kind: "save_rule", payload: { name: "Payment check", enabled: true } }

        const result = toFlowRequest(input)

        expect(result).toEqual({ kind: "save_rule", payload: { name: "Payment check", enabled: true } })
        expect(result.payload).toBe(input.payload)
        expect(result).not.toBe(input)
    })

    it("maps the result data into a new response", () => {
        const result: FlowResult = { data: { id: "rule-1", revision: 3, enabled: true } }

        const response = toRunFlowResponse(result)

        expect(response).toEqual({ data: { id: "rule-1", revision: 3, enabled: true } })
        expect(response.data).toBe(result.data)
        expect(response).not.toBe(result)
    })
})
