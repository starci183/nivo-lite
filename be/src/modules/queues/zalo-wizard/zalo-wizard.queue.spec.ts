import { isZaloWizardPayload, ZALO_WIZARD_QUEUE } from "./zalo-wizard.queue"

describe("Zalo wizard queue", () => {
    it("uses the queue name shared with the wizard commands", () => {
        expect(ZALO_WIZARD_QUEUE).toBe("zalo_wizard")
    })

    it.each([
        { workspaceId: "workspace-1", connectionId: "connection-1", command: "app", ticket: "ticket-1" },
        { workspaceId: "workspace-1", connectionId: "connection-1", command: "oa", ticket: "ticket-1" },
        { workspaceId: "workspace-1", connectionId: "connection-1", command: "begin", ticket: "ticket-1" },
    ])("accepts a wizard command payload: %p", (payload) => {
        expect(isZaloWizardPayload(payload)).toBe(true)
    })

    it.each([
        { connectionId: "connection-1", command: "app", ticket: "ticket-1" },
        { workspaceId: 1, connectionId: "connection-1", command: "app", ticket: "ticket-1" },
        { workspaceId: "workspace-1", command: "app", ticket: "ticket-1" },
        { workspaceId: "workspace-1", connectionId: 1, command: "app", ticket: "ticket-1" },
        { workspaceId: "workspace-1", connectionId: "connection-1", ticket: "ticket-1" },
        { workspaceId: "workspace-1", connectionId: "connection-1", command: 1, ticket: "ticket-1" },
        { workspaceId: "workspace-1", connectionId: "connection-1", command: "unknown", ticket: "ticket-1" },
        { workspaceId: "workspace-1", connectionId: "connection-1", command: "app" },
        { workspaceId: "workspace-1", connectionId: "connection-1", command: "app", ticket: 1 },
        {},
        [],
    ])("rejects a missing or wrongly typed wizard field: %p", (payload) => {
        expect(isZaloWizardPayload(payload)).toBe(false)
    })

    it.each([undefined, null, "payload", 1, true, Symbol("payload"), BigInt(1), () => undefined])(
        "rejects a non-object payload: %p",
        (payload) => {
            expect(isZaloWizardPayload(payload)).toBe(false)
        },
    )
})
