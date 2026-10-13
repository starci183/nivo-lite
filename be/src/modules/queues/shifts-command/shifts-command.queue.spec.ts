import { SHIFTS_COMMAND_QUEUE, isShiftsCommandPayload } from "./shifts-command.queue"

describe("SHIFTS_COMMAND_QUEUE", () => {
    it("names the database queue used by the command processor", () => {
        expect(SHIFTS_COMMAND_QUEUE).toBe("shifts_command")
    })
})

describe("isShiftsCommandPayload", () => {
    it.each([
        { name: "a command", payload: { workspaceId: "ws-1", commandId: "command-1" } },
        { name: "empty string ids", payload: { workspaceId: "", commandId: "" } },
        {
            name: "additional fields",
            payload: { workspaceId: "ws-1", commandId: "command-1", attempt: 2 },
        },
        {
            name: "an array with both string ids",
            payload: Object.assign([], { workspaceId: "ws-1", commandId: "command-1" }),
        },
    ])("accepts $name", ({ payload }) => {
        expect(isShiftsCommandPayload(payload)).toBe(true)
    })

    it.each([
        { name: "undefined", payload: undefined },
        { name: "null", payload: null },
        { name: "a string", payload: "command-1" },
        { name: "a number", payload: 1 },
        { name: "a boolean", payload: true },
        { name: "an empty array", payload: [] },
        { name: "an empty object", payload: {} },
        { name: "a missing workspace id", payload: { commandId: "command-1" } },
        { name: "a null workspace id", payload: { workspaceId: null, commandId: "command-1" } },
        { name: "an undefined workspace id", payload: { workspaceId: undefined, commandId: "command-1" } },
        { name: "a numeric workspace id", payload: { workspaceId: 1, commandId: "command-1" } },
        { name: "a missing command id", payload: { workspaceId: "ws-1" } },
        { name: "a null command id", payload: { workspaceId: "ws-1", commandId: null } },
        { name: "an undefined command id", payload: { workspaceId: "ws-1", commandId: undefined } },
        { name: "a numeric command id", payload: { workspaceId: "ws-1", commandId: 1 } },
    ])("refuses $name", ({ payload }) => {
        expect(isShiftsCommandPayload(payload)).toBe(false)
    })
})
