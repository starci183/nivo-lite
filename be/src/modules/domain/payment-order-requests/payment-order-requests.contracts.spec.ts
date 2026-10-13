import { isPaymentOrderRequestPayload } from "./payment-order-requests.contracts"

describe("isPaymentOrderRequestPayload", () => {
    it.each([
        { value: undefined },
        { value: null },
        { value: true },
        { value: 1 },
        { value: "request-1" },
        { value: [] },
        { value: {} },
        { value: { requestId: "request-1" } },
        { value: { workspaceId: 1, requestId: "request-1" } },
        { value: { workspaceId: "ws-1" } },
        { value: { workspaceId: "ws-1", requestId: null } },
        { value: { workspaceId: "ws-1", requestId: 1 } },
    ])("rejects an incomplete payload: $value", ({ value }) => {
        expect(isPaymentOrderRequestPayload(value)).toBe(false)
    })

    it.each([
        { workspaceId: "ws-1", requestId: "request-1" },
        { workspaceId: "", requestId: "" },
        { workspaceId: "ws-1", requestId: "request-1", amount: 990000 },
    ])("accepts two string ids: %p", (value) => {
        expect(isPaymentOrderRequestPayload(value)).toBe(true)
    })
})
