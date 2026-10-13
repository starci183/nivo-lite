import { CONNECTION_COMMANDS_QUEUE, isConnectionCommandPayload } from "./connection-commands.queue"

describe("isConnectionCommandPayload", () => {
    it("names the producer and processor queue", () => {
        expect(CONNECTION_COMMANDS_QUEUE).toBe("connection_commands")
    })

    it.each([
        undefined,
        null,
        false,
        1,
        "command-1",
        [],
        {},
        { workspaceId: "workspace-1" },
        { commandId: 1, workspaceId: "workspace-1" },
        { commandId: "command-1" },
        { commandId: "command-1", workspaceId: false },
    ])("refuses the malformed payload %p", (payload) => {
        expect(isConnectionCommandPayload(payload)).toBe(false)
    })

    it.each([
        { commandId: "command-1", workspaceId: "workspace-1" },
        { commandId: "", workspaceId: "" },
        { commandId: "command-1", workspaceId: "workspace-1", extra: true },
    ])("accepts two string ids in %p", (payload) => {
        expect(isConnectionCommandPayload(payload)).toBe(true)
    })
})
