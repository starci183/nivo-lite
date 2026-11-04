import { ConnectionReadyEvent } from "@modules/events/api"

const input = { workspaceId: "ws-1", connectionId: "conn-1", provider: "sepay", dedupeKey: "conn-1:api_token:abc" }

describe("ConnectionReadyEvent", () => {
    it("is identified by its dedupe key and reads back what it carried", () => {
        const event = ConnectionReadyEvent.create(input)

        expect(event.eventId).toBe("conn-1:api_token:abc")
        expect(ConnectionReadyEvent.parse({ eventId: event.eventId, payload: event.payload })?.payload).toEqual(input)
    })

    it.each([
        ["a malformed envelope", "text"],
        ["a payload without a workspace", { eventId: "e", payload: { ...input, workspaceId: undefined } }],
        ["a payload without a connection", { eventId: "e", payload: { ...input, connectionId: "" } }],
        ["a payload without a provider", { eventId: "e", payload: { ...input, provider: 3 } }],
        ["a payload without a dedupe key", { eventId: "e", payload: { ...input, dedupeKey: undefined } }],
    ])("refuses %s", (_name, envelope) => {
        expect(ConnectionReadyEvent.parse(envelope)).toBeNull()
    })
})
