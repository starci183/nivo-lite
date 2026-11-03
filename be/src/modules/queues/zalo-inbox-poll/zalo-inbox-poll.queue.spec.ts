import { isZaloInboxPollPayload } from "./zalo-inbox-poll.queue"

describe("isZaloInboxPollPayload", () => {
    it.each([
        ["the tick payload", {}],
        ["a payload naming a connection and its workspace", { connectionId: "c-1", workspaceId: "ws-1" }],
    ])("accepts %s", (_name, value) => {
        expect(isZaloInboxPollPayload(value)).toBe(true)
    })

    it.each([
        ["a missing payload", null],
        ["a text", "x"],
        ["a connection without its workspace", { connectionId: "c-1" }],
        ["a workspace without its connection", { workspaceId: "ws-1" }],
        ["an empty id", { connectionId: "", workspaceId: "ws-1" }],
    ])("refuses %s", (_name, value) => {
        expect(isZaloInboxPollPayload(value)).toBe(false)
    })
})
