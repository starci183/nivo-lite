import { isMetaInboundJob, META_INBOUND_QUEUE } from "./meta-inbox.contracts"

describe("isMetaInboundJob", () => {
    it.each([
        { value: undefined },
        { value: null },
        { value: true },
        { value: 1 },
        { value: "job" },
        { value: [] },
        { value: {} },
        { value: { connectionId: null } },
        { value: { connectionId: 1 } },
        { value: { connectionId: "connection-1" } },
        { value: { connectionId: "connection-1", workspaceId: null } },
        { value: { connectionId: "connection-1", workspaceId: 1 } },
        { value: { connectionId: "connection-1", workspaceId: "workspace-1" } },
        { value: { connectionId: "connection-1", workspaceId: "workspace-1", event: undefined } },
        { value: { connectionId: "connection-1", workspaceId: "workspace-1", event: null } },
        { value: { connectionId: "connection-1", workspaceId: "workspace-1", event: "dm" } },
        { value: { connectionId: "connection-1", workspaceId: "workspace-1", event: 1 } },
    ])("rejects an incomplete payload: $value", ({ value }) => {
        expect(isMetaInboundJob(value)).toBe(false)
    })

    it.each([
        { connectionId: "connection-1", workspaceId: "workspace-1", event: { kind: "dm", event_key: "dm:message-1" } },
        { connectionId: "", workspaceId: "", event: {} },
        { connectionId: "connection-1", workspaceId: "workspace-1", event: [] },
        { connectionId: "connection-1", workspaceId: "workspace-1", event: {}, attempt: 2 },
    ])("accepts string ids and a non-null object event: %p", (value) => {
        expect(isMetaInboundJob(value)).toBe(true)
    })
})

describe("meta inbound queue contract", () => {
    it("names the queue meta_inbound", () => {
        expect(META_INBOUND_QUEUE).toBe("meta_inbound")
    })
})
